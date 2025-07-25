import { useState, useEffect, useRef } from 'react';
import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose';
import type { Results } from '@mediapipe/pose';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { Camera } from '@mediapipe/camera_utils';
import './App.css';

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [name, setName] = useState('');
  const [count, setCount] = useState(0);
  const [timer, setTimer] = useState(60);
  const [mode, setMode] = useState<'jumpingJack' | 'kneeTouch' | 'pullup' | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [readyToCount, setReadyToCount] = useState(false);

  const [tempName, setTempName] = useState('');

  const stateRef = useRef('down');
  const kneeStateRef = useRef('down');
  const pullupStateRef = useRef('down');

  // Countdown: 3-2-1
  const runCountdown = (callback: () => void) => {
    let counter = 3;
    setCountdown(counter);
    const interval = setInterval(() => {
      counter--;
      if (counter === 0) {
        clearInterval(interval);
        setCountdown(null);
        setReadyToCount(true);
        callback();
      } else {
        setCountdown(counter);
      }
    }, 1000);
  };

  useEffect(() => {
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    const pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });


    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults((results: Results) => {
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      if (results.poseLandmarks) {
        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
          color: '#161b16ff',
          lineWidth: 4,
        });
        drawLandmarks(ctx, results.poseLandmarks, {
          color: '#3912b8ff',
          lineWidth: 2,
        });

        if (!readyToCount) {
          ctx.restore();
          return;
        }

        const landmarks = results.poseLandmarks;
        const POSE_LANDMARKS = {
          leftElbow: 13,
          rightElbow: 14,
          leftHip: 23,
          rightHip: 24,
          leftKnee: 25,
          rightKnee: 26,
          leftShoulder: 11,
          rightShoulder: 12,
          leftWrist: 15,
          rightWrist: 16,
        };

        const get = (part: keyof typeof POSE_LANDMARKS) => {
          const landmark = landmarks[POSE_LANDMARKS[part]];
          return landmark && landmark.visibility! > 0.5 ? landmark : null;
        };

        const leftElbow = get("leftElbow");
        const rightElbow = get("rightElbow");
        const leftHip = get("leftHip");
        const rightHip = get("rightHip");
        const leftKnee = get("leftKnee");
        const rightKnee = get("rightKnee");
        const leftShoulder = get("leftShoulder");
        const rightShoulder = get("rightShoulder");
        const leftWrist = get("leftWrist");
        const rightWrist = get("rightWrist");

        // Logic for each mode
        if (mode === 'jumpingJack' && leftElbow && rightElbow && leftWrist && rightWrist && leftHip && rightHip) {
          const wristY = (leftWrist.y + rightWrist.y) / 2;
          const hipY = (leftHip.y + rightHip.y) / 2;
          // const rightWristX = rightWrist.x;
          // const leftWristX = leftWrist.x;
          // const rightHipX = rightHip.x;
          // const leftHipX = leftHip.x;
          
          const thresholdY = 0.5;
          if (leftElbow.y < thresholdY && rightElbow.y < thresholdY && stateRef.current === 'down') {
            stateRef.current = 'up';
          } else if ((wristY - hipY) < 0.05 && Math.abs(rightWrist.x - rightHip.x) < 0.1 && Math.abs(leftWrist.x - leftHip.x) < 0.1 && stateRef.current === 'up') {
            setCount((c) => c + 1);
            stateRef.current = 'down';
          }
        }

        if (mode === 'kneeTouch' && leftHip && rightHip && leftKnee && rightKnee) {
          const hipY = (leftHip.y + rightHip.y) / 2;
          const kneeY = Math.min(leftKnee.y, rightKnee.y);
          if (kneeY < hipY - 0.05 && kneeStateRef.current === 'down') {
            kneeStateRef.current = 'up';
          } else if (kneeY > hipY + 0.05 && kneeStateRef.current === 'up') {
            setCount((c) => c + 1);
            kneeStateRef.current = 'down';
          }
        }

        if (mode === 'pullup' && leftShoulder && rightShoulder && leftElbow && rightElbow) {
          const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
          const avgElbowY = (leftElbow.y + rightElbow.y) / 2;
          if (avgShoulderY < avgElbowY - 0.05 && pullupStateRef.current === 'down' && avgShoulderY < 0.25) {
            pullupStateRef.current = 'up';
          } else if (avgShoulderY > avgElbowY + 0.05 && pullupStateRef.current === 'up') {
            setCount((c) => c + 1);
            pullupStateRef.current = 'down';
          }
        }
      }

      ctx.restore();
    });

    const camera = new Camera(video, {
      onFrame: async () => {
        await pose.send({ image: video });
      },
      width: 640,
      height: 480,
    });

    camera.start();
  }, [readyToCount, mode]);

  // Timer effect
  useEffect(() => {
    if (!readyToCount) return;

    setCount(0);
    setTimer(60);
    const interval = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(interval);
          setReadyToCount(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [readyToCount]);

  const handleStart = (exercise: typeof mode) => {

    if (mode === exercise && readyToCount) {
      setMode(null);
      setReadyToCount(false);
      return;
    }
    setMode(null);
    setCount(0);
    setTimer(60);
    setReadyToCount(false);
    runCountdown(() => {                
      setMode(exercise);
      console.log(`${exercise} started`)});
  };

  return (
    <div className="container" style={{ position: 'relative' }}>
      {countdown !== null && (
        <div className="countdown-overlay">
          <div>{countdown}</div>
        </div>
      )}


      <div className="left">
        <h1 style={{ color: 'black' }}>Exercise Counter</h1>
        <canvas ref={canvasRef} width={640} height={480} />
        <div className="infoBox">Timer: {timer}s</div>
      </div>

      <div className="right">
        <iframe
          width="100%"
          height="auto"
          src="https://www.youtube.com/embed/BmDD1twcD7o"
          frameBorder="0"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="instruction-vid"
        />

        <div id="instructions">Stand 5 feet away from the camera</div>

        {!name ? (
          <input
            type="text"
            placeholder="Enter your name"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tempName.trim() !== '') {
                setName(tempName.trim());
              }
            }}
          />
        ) : (
          <div id="userName">Hello, {name}!</div>
        )}

        <button onClick={() => handleStart('jumpingJack')}>
          {mode === 'jumpingJack' && readyToCount ? 'Stop Jumping Jacks' : 'Start Jumping Jacks'}
        </button>

        <button onClick={() => handleStart('kneeTouch')}>
          {mode === 'kneeTouch' && readyToCount ? 'Stop Knee Touches' : 'Start Knee Touches'}
        </button>

        <button onClick={() => handleStart('pullup')}>
          {mode === 'pullup' && readyToCount ? 'Stop Pull-Ups' : 'Start Pull-Ups'}
        </button>

        <div className="infoBox">Count: {count}</div>
      </div>

      <video ref={videoRef} style={{ display: 'none' }} autoPlay playsInline />
    </div>
  );
}

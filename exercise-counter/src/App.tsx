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
  const [timer, setTimer] = useState(600);
  const [mode, setMode] = useState<'jumpingJack' | 'kneeTouch' | 'pullup' | 'squat' | null>(null);
  const [countdown] = useState<number | null>(null);
  const [readyToCount, setReadyToCount] = useState(false);

  const [tempName, setTempName] = useState('');

  const stateRef = useRef('down');
  const kneeStateRef = useRef('down');
  const pullupStateRef = useRef('down');
  const squatStateRef = useRef('up');

  const lastShoulderYRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const shoulderWentDownRef = useRef(false);

  const [preparingExercise, setPreparingExercise] = useState<typeof mode | null>(null);
  // const [setPoseReadyStart] = useState<number | null>(null);
  const poseReadyStartRef = useRef<number | null>(null);
  const [, setPoseHeldFor3Sec] = useState(false);
  const [showPoseReadyOverlay, setShowPoseReadyOverlay] = useState(false);

  const poseTriggeredRef = useRef(false);

  const [poseIncorrect, setPoseIncorrect] = useState(false);






  // Countdown: 3-2-1
  // const runCountdown = (callback: () => void) => {
  //   let counter = 3;
  //   setCountdown(counter);
  //   const interval = setInterval(() => {
  //     counter--;
  //     if (counter === 0) {
  //       clearInterval(interval);
  //       setCountdown(null);
  //       setReadyToCount(true);
  //       callback();
  //     } else {
  //       setCountdown(counter);
  //     }
  //   }, 1000);
  // };

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

      // Draw horizontal reference lines
        ctx.beginPath();
        ctx.moveTo(0, 0.42 * canvas.height);
        ctx.lineTo(canvas.width, 0.42 * canvas.height);
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 0.55 * canvas.height);
        ctx.lineTo(canvas.width, 0.55 * canvas.height);
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 1;
        ctx.stroke();

      if (results.poseLandmarks) {
        let poseQualityColor = 'red';
        const FACE_LANDMARK_INDICES = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

        const filteredConnections = POSE_CONNECTIONS.filter(
          ([a, b]) => !FACE_LANDMARK_INDICES.has(a) && !FACE_LANDMARK_INDICES.has(b)
        );

        drawConnectors(ctx, results.poseLandmarks, filteredConnections, {
          color: '#161b16ff',
          lineWidth: 4,
        });

        const faceIndices = new Set([
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 // nose, eyes, ears
        ]);

        const bodyOnlyLandmarks = results.poseLandmarks.filter((_, i) => !faceIndices.has(i));

        drawLandmarks(ctx, bodyOnlyLandmarks, {
          color: poseQualityColor,
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


        function isReadyForJumpingJack(
          leftShoulder: any, rightShoulder: any
        ): boolean {

          const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
          return avgShoulderY >= 0.38 && avgShoulderY <= 0.6;
        }


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
        if (mode === 'jumpingJack' && leftElbow && rightElbow && leftWrist && rightWrist && leftHip && rightHip && leftShoulder && rightShoulder) {
          setPoseIncorrect(false);
          const ready = isReadyForJumpingJack(leftShoulder, rightShoulder);
          console.log(`Jumping Jack ready: ${ready}`);


          // Track if user has held the correct pose for 3 seconds
          if (!poseTriggeredRef.current) {

            poseQualityColor = ready ? 'green' : 'red';

            if (ready) {
              if (poseReadyStartRef.current === null) {
                poseReadyStartRef.current = Date.now();
              } else if (Date.now() - poseReadyStartRef.current >= 3000) {
                poseTriggeredRef.current = true;
                setPoseHeldFor3Sec(true);
                setShowPoseReadyOverlay(true);
                poseReadyStartRef.current = null;

                setTimeout(() => {
                  setShowPoseReadyOverlay(false);
                  setReadyToCount(true);
                }, 1000);
              }
            } else {
              poseReadyStartRef.current = null; // pose broken
            }
            

            drawLandmarks(ctx, bodyOnlyLandmarks, {
              color: poseQualityColor,
              lineWidth: 2,
            });
            ctx.restore();
            return;
          }

          const readyAfterOverlay = isReadyForJumpingJack(leftShoulder, rightShoulder);
          poseQualityColor = readyAfterOverlay ? 'blue' : 'red';

          drawLandmarks(ctx, bodyOnlyLandmarks, {
            color: 'blue',
            lineWidth: 2,
          });
          ctx.restore();

          



          // drawLandmarks(ctx, bodyOnlyLandmarks, {
          //   color: poseQualityColor,
          //   lineWidth: 2,
          // });

          const wristY = (leftWrist.y + rightWrist.y) / 2;
          const hipY = (leftHip.y + rightHip.y) / 2;
    
          if (leftElbow.y < leftShoulder.y && rightElbow.y < rightShoulder.y && stateRef.current === 'down') {
            stateRef.current = 'up';
          } else if (Math.abs(wristY - hipY) < 0.05 && stateRef.current === 'up') {
            if(Math.abs(rightWrist.x - rightHip.x) < 0.1 && Math.abs(leftWrist.x - leftHip.x) < 0.1) {
              setCount((c) => c + 1);
              stateRef.current = 'down';
            }
            
          }
        }
        else if (!leftElbow || !rightElbow || !leftWrist || !rightWrist || !leftHip || !rightHip || !leftShoulder || !rightShoulder) {
          setPoseIncorrect(true);
  
        }

        if (mode === 'kneeTouch' && leftHip && rightHip && leftKnee && rightKnee) {
          const hipY = (leftHip.y + rightHip.y) / 2;
          const kneeY = Math.min(leftKnee.y, rightKnee.y);
          if (kneeY < hipY + 0.15 && kneeStateRef.current === 'down') {
            kneeStateRef.current = 'up';
          } else if (kneeY > hipY + 0.25 && kneeStateRef.current === 'up') {
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

        if (mode === 'squat' && leftHip && rightHip && leftKnee && rightKnee &&leftShoulder && rightShoulder) {

          const avgHipY = (leftHip.y + rightHip.y) / 2;
          const avgKneeY = (leftKnee.y + rightKnee.y) / 2;
          const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;

          const now = Date.now();

          if (now - lastUpdateTimeRef.current >= 250) {
            const lastY = lastShoulderYRef.current;
            if (lastY !== null && avgShoulderY > lastY + 0.03) {
              // Shoulders went down significantly
              shoulderWentDownRef.current = true;
            } else {
              shoulderWentDownRef.current = false;
            }
            lastShoulderYRef.current = avgShoulderY;
            lastUpdateTimeRef.current = now;
          }

          if (avgHipY < avgKneeY - 0.225 && squatStateRef.current === 'down') {
            squatStateRef.current = 'up';
            console.log(squatStateRef.current);
          } else if (avgHipY > avgKneeY - 0.175 && squatStateRef.current === 'up' && shoulderWentDownRef.current) {
            setCount((c) => c + 1);
            squatStateRef.current = 'down';
            console.log(squatStateRef.current);
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
    setTimer(600);
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
      setPoseHeldFor3Sec(false);
      poseReadyStartRef.current = null;
      poseTriggeredRef.current = false;

      return;
    }
    setMode(null);
    setCount(0);
    setTimer(600);
    setReadyToCount(false);
    setPoseHeldFor3Sec(false);
    poseReadyStartRef.current = null;
    poseTriggeredRef.current = false;

    setPreparingExercise(exercise);

    setTimeout(() => {
    setPreparingExercise(null);
    setMode(exercise);
    setReadyToCount(true);
    console.log(`${exercise} started`);
  }, 3000);
  };

  return (
    <div className="container" style={{ position: 'relative' }}>
      {countdown !== null && (
        <div className="countdown-overlay">
          <div>{countdown}</div>
        </div>
      )}

      {preparingExercise && (
        <div className="exercise-overlay">
          <p>Please arrange yourself till the dots are green</p>
        </div>
      )}

      {showPoseReadyOverlay && (
        <div className="pose-ready-overlay">
          <p>Pose ready! Starting now...</p>
        </div>
      )}

      {poseIncorrect && (
        <div className="incorrect-overlay">
          <p>INCORRECT</p>
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

        <button onClick={() => handleStart('squat')}>
          {mode === 'squat' && readyToCount ? 'Stop Squats' : 'Start Squats'}
        </button>

        <div className="infoBox">Count: {count}</div>
      </div>

      <video ref={videoRef} style={{ display: 'none' }} autoPlay playsInline />
    </div>
  );
}

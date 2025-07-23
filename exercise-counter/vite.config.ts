import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Replace YOUR-REPO-NAME below with your actual repo name
export default defineConfig({
  base: '/Exercise-Counter/', // <-- this must match repo name
  plugins: [react()]
})

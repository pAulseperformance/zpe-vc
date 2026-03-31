import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import glsl from 'vite-plugin-glsl'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss(), glsl()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three') || id.includes('node_modules/@react-three')) {
            return 'three-vendor'
          }
          if (id.includes('node_modules/@mediapipe/tasks-vision')) {
            return 'vision-vendor'
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'motion-vendor'
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor'
          }
          return undefined
        },
      },
    },
  },
})

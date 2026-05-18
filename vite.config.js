import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// For GitHub Pages: app lives at https://<user>.github.io/<repo>/
// Set base to match the repo name
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/skinscript/',
})

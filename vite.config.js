import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Served from the custom apex domain https://osamah.co/ — root base path.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
})

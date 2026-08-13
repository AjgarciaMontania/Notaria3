import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// La app se empaqueta dentro del APK, por eso las rutas deben ser relativas.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
});

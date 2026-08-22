import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const aqui = path.dirname(fileURLToPath(import.meta.url));

// La app se empaqueta dentro del APK, por eso las rutas deben ser relativas.
// El commit con el que se compila. Lo pone GitHub Actions al publicar; en el
// computador de casa no existe y queda en "local", que apaga la actualización
// automática. Así, probando en local, internet nunca reemplaza lo que se está
// mirando.
const COMMIT = process.env.GITHUB_SHA || 'local';

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __COMMIT__: JSON.stringify(COMMIT),
  },
  resolve: {
    alias: {
      // ÚNICA FUENTE DE VERDAD del cálculo de tarifas.
      // Apunta a los archivos de la página web (../src/utils), así que las
      // dos aplicaciones liquidan exactamente igual y las tarifas se tocan
      // en un solo sitio. No dupliques estos archivos aquí.
      '@calculo': path.resolve(aqui, '../src/utils'),
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
    commonjsOptions: {
      // El motor vive fuera de la carpeta del proyecto
      include: [/node_modules/],
    },
  },
  server: {
    fs: {
      // Permite servir los archivos del motor durante el desarrollo
      allow: [path.resolve(aqui, '..')],
    },
  },
});

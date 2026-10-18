import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Copies the Stockfish WASM engine files next to the built app so the
// Web Worker can load them from a relative URL at runtime.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/stockfish.wasm/stockfish.wasm',
          dest: 'engine',
        },
        {
          src: 'node_modules/stockfish.wasm/stockfish.worker.js',
          dest: 'engine',
        },
        {
          src: 'node_modules/stockfish.wasm/stockfish.js',
          dest: 'engine',
        },
      ],
    }),
  ],
  server: {
    port: 5173,
    // Required for the threaded Stockfish WASM build (SharedArrayBuffer).
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  worker: {
    format: 'es',
  },
});

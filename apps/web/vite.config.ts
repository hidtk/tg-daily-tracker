import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Local dev: proxy API to `wrangler dev` (apps/worker) on :8787
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: { target: 'es2020', sourcemap: false },
});

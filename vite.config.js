import { defineConfig } from 'vite';

export default defineConfig({
  resolve: { preserveSymlinks: true },
  optimizeDeps: { esbuildOptions: { preserveSymlinks: true, tsconfigRaw: {} } },
  build: { rollupOptions: {input:{main:'index.html',roadster:'roadster.html'}}, target: 'es2020', chunkSizeWarningLimit: 1600 },
});

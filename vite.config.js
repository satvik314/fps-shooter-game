import { defineConfig } from 'vite';

export default defineConfig({
  // relative base so the build can be dropped on any static host / subpath
  base: './',
  server: { host: true, port: 5173 },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
});

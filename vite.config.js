import { defineConfig } from 'vite';

// Relative base so the build works from any static host or sub-path (GitHub Pages, Netlify...).
export default defineConfig({
  base: './',
  build: { target: 'es2020', assetsInlineLimit: 0 },
});

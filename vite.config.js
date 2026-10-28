import { defineConfig } from 'vite';

// Build id shared by the bundle (__BUILD__) and dist/version.json, used for auto-update.
const BUILD = new Date().toISOString().replace(/\D/g, '').slice(0, 12);

const versionFile = {
  name: 'version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) });
  },
};

// Relative base so the build works from any static host or sub-path (GitHub Pages, Netlify...).
export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [versionFile],
  build: { target: 'es2020', assetsInlineLimit: 0 },
});

import fs from 'node:fs';
import path from 'node:path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      {
        name: 'copy-hymns-json',
        closeBundle() {
          const src = path.resolve(import.meta.dirname, 'src/data/hymns.json');
          const dest = path.resolve(import.meta.dirname, 'dist/src/data/hymns.json');
          fs.mkdirSync(path.dirname(dest), {recursive: true});
          fs.copyFileSync(src, dest);
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

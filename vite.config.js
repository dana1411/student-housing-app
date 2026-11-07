import { defineConfig } from 'vite';
import fs from 'node:fs';

// The app's name and key prefix live in app.config.json. "Lodgely" in the source is
// replaced with the configured name at build time, so renaming is a one-line change.
const cfg = JSON.parse(fs.readFileSync(new URL('./app.config.json', import.meta.url), 'utf8'));
const brand = {
  name: 'brand-name',
  enforce: 'pre',
  transform(code, id) {
    if (/[\\/]src[\\/]app[\\/].*\.js$/.test(id)) {
      return code.replaceAll('Lodgely', cfg.name).replaceAll('LDG-', cfg.keyPrefix + '-');
    }
  },
  transformIndexHtml(html) { return html.replaceAll('Lodgely', cfg.name); }
};

export default defineConfig({
  base: './',
  plugins: [brand],
  build: { target: 'es2022', outDir: 'dist', chunkSizeWarningLimit: 2000 },
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  server: { host: true }
});

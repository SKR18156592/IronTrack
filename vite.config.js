import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// index.html pulls its larger blocks (sign-in, each tab, the modals) from src/partials/ with
// <!-- @include name.html --> on a line of its own. Each partial is indented to match the line.
const PARTIALS = resolve(import.meta.dirname, 'src/partials');
function htmlIncludes() {
  return {
    name: 'html-includes',
    transformIndexHtml: {
      order: 'pre',
      handler: html =>
        html.replace(/^([ \t]*)<!-- @include ([\w-]+\.html) -->$/gm, (_, indent, file) =>
          readFileSync(resolve(PARTIALS, file), 'utf8')
            .trimEnd()
            .split('\n')
            .map(line => (line ? indent + line : line))
            .join('\n')
        )
    },
    // The dev server doesn't know index.html depends on the partials: reload when one changes.
    configureServer(server) {
      server.watcher.add(PARTIALS);
      server.watcher.on('change', file => {
        if (file.startsWith(PARTIALS)) server.ws.send({ type: 'full-reload' });
      });
    }
  };
}

export default defineConfig({
  // Keep /*! */ license notices (ours and our dependencies') in the built bundles.
  esbuild: { legalComments: 'eof' },
  test: {
    include: ['tests/**/*.test.js'] // e2e/ holds Playwright specs: npm run test:e2e
  },
  plugins: [
    htmlIncludes(),
    VitePWA({
      // Our own worker (src/sw.js); the plugin only fills in the list of files to precache.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectRegister: false, // src/main.js registers it
      manifest: false, // public/manifest.webmanifest is used as is
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}']
      }
    })
  ]
});

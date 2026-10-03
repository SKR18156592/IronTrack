import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'] // e2e/ holds Playwright specs: npm run test:e2e
  },
  plugins: [
    VitePWA({
      // Our own worker (src/sw.js); the plugin only fills in the list of files to precache.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectRegister: false, // src/main.js registers it
      manifest: false,       // public/manifest.webmanifest is used as is
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}']
      }
    })
  ]
});

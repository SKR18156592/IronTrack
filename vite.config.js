import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
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

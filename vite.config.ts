/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { handleMetaRequest } from './api/_lib/fetchMeta';

/** Runs the /api/meta server function inside the dev server (on Vercel it's api/meta.ts). */
function devApi(): Plugin {
  return {
    name: 'lepak-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/meta', (req, res) => {
        const request = new Request(`http://localhost${req.originalUrl ?? req.url ?? ''}`);
        void handleMetaRequest(request).then(async (r) => {
          res.statusCode = r.status;
          r.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await r.arrayBuffer()));
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});

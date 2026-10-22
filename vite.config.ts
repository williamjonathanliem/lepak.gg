/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { handleMetaRequest } from './api/_lib/fetchMeta';

type Handler = (request: Request) => Promise<Response>;

/** Turns a Node dev-server request into a web Request (headers and body included). */
async function toRequest(req: Connect.IncomingMessage): Promise<Request> {
  // Pass the browser's headers through so the same-site check works in dev too.
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers.set(k, v);
  }
  const host = req.headers.host ?? 'localhost';
  const chunks: Buffer[] = [];
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    for await (const c of req) chunks.push(c as Buffer);
  }
  return new Request(`http://${host}${req.originalUrl ?? req.url ?? ''}`, {
    method: req.method,
    headers,
    body: chunks.length ? Buffer.concat(chunks) : undefined,
  });
}

/** Runs the server functions inside the dev server (on Vercel they're the files in api/). */
function devApi(): Plugin {
  const routes: Record<string, () => Promise<Handler>> = {
    '/api/meta': async () => handleMetaRequest,
    // Loaded only when used, so Genkit doesn't slow down every dev start.
    '/api/ai-notes': async () => (await import('./api/_lib/aiNotes')).handleAiNotesRequest,
    '/api/ai-slides': async () => (await import('./api/_lib/aiSlides')).handleAiSlidesRequest,
    '/api/wall': async () => (await import('./api/_lib/wallPost')).handleWallRequest,
    '/api/receipt': async () => (await import('./api/_lib/receipt')).handleReceiptRequest,
  };
  return {
    name: 'lepak-dev-api',
    configureServer(server) {
      for (const [path, load] of Object.entries(routes)) {
        server.middlewares.use(path, (req, res) => {
          void (async () => {
            const r = await (await load())(await toRequest(req));
            res.statusCode = r.status;
            r.headers.forEach((value, key) => res.setHeader(key, value));
            res.end(Buffer.from(await r.arrayBuffer()));
          })().catch((e: unknown) => {
            res.statusCode = 500;
            res.end(String(e));
          });
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  // Everything in .env.local (e.g. GEMINI_API_KEY) for the dev API routes, like Vercel gives
  // its functions. This is server-side only: the browser still gets just the VITE_ names.
  for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  return {
    plugins: [react(), tailwindcss(), devApi()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      exclude: ['e2e/**', 'node_modules/**', 'scripts/cleanup/**'],
    },
  };
});

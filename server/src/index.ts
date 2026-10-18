/** ai-chess-tutor server: Fastify + SQLite. Serves /api/* and the built client. */
import 'dotenv/config';
import Fastify from 'fastify';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './db/index.js';
import { seed } from './db/seed.js';
import { registerRoutes } from './routes.js';
import { API_VERSION } from '@chesstutor/shared';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT ?? '3001', 10);
const APP_TOKEN = process.env.APP_TOKEN ?? '';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

async function main(): Promise<void> {
  const db = getDb();
  seed(db);

  const app = Fastify({ logger: false });

  // Cross-origin isolation headers: required by the threaded Stockfish WASM
  // build (SharedArrayBuffer). The app loads no cross-origin resources.
  app.addHook('onSend', async (_req, reply) => {
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    reply.header('Cross-Origin-Embedder-Policy', 'require-corp');
  });

  // Optional single-user token.
  app.addHook('onRequest', async (req, reply) => {
    if (!APP_TOKEN) return;
    if (req.url === '/api/health') return;
    if (req.headers.authorization !== `Bearer ${APP_TOKEN}`) {
      reply.code(401).send({ error: 'Unauthorized: set Authorization: Bearer <APP_TOKEN>' });
    }
  });

  app.setErrorHandler((err: unknown, _req, reply) => {
    const e = err as { statusCode?: number; message?: string };
    reply.code(e.statusCode ?? 500).send({ error: e.message ?? 'Internal error' });
  });

  registerRoutes(app, db);

  // Static client (production). In dev, Vite serves the client and proxies /api here.
  const distDir = join(here, '..', '..', 'client', 'dist');
  app.get('/*', async (req, reply) => {
    const urlPath = new URL(req.url, 'http://x').pathname;
    if (urlPath.startsWith('/api/')) {
      reply.code(404).send({ error: 'Unknown API route' });
      return;
    }
    const rel = urlPath === '/' ? '/index.html' : urlPath;
    const candidates = [join(distDir, rel), join(distDir, 'index.html')];
    for (const file of candidates) {
      try {
        const data = await readFile(file);
        reply.header('content-type', MIME[extname(file)] ?? 'application/octet-stream');
        reply.send(data);
        return;
      } catch {
        // try next candidate
      }
    }
    reply.code(404).send({ error: 'Not found' });
  });

  await app.listen({ port: PORT, host: '0.0.0.0' });
  // eslint-disable-next-line no-console
  console.log(`ai-chess-tutor server v${API_VERSION} listening on :${PORT} (auth ${APP_TOKEN ? 'on' : 'off'})`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Fatal:', e);
  process.exit(1);
});

# AI Chess Tutor

A personalized, adaptive chess tutor: structured lessons, exercises, puzzles, game analysis, and an AI coach. Single-user, local-first.

## Stack

- **Server:** Node 22+, Fastify, `node:sqlite` (SQLite, file-based), `chess.js`
- **Client:** React + Vite + Tailwind, `react-chessboard`, Stockfish engine in a Web Worker (client-side analysis)
- **Shared:** `@chesstutor/shared` — concept taxonomy, types, API contract
- **AI tutor:** server-side provider abstraction (OpenAI / Anthropic / OpenAI-compatible); all AI-suggested moves validated with chess.js before reaching the client

## Install

```bash
npm install
cp .env.example .env   # then set values (see below)
```

Requires Node >= 20 at root; server requires Node >= 22.5 (uses `node:sqlite`).

## Dev

```bash
npm run dev        # server (tsx watch, :3001) + client (Vite) concurrently
```

## Env vars (see `.env.example`)

| Var | Purpose |
|---|---|
| `PORT` | Server port (default 3001) |
| `DATA_DIR` | SQLite directory (default `./data` under server/) |
| `APP_TOKEN` | Private access token entered at runtime; app issues an HttpOnly SameSite session cookie |
| `AI_PROVIDER` | `openai` \| `anthropic` \| `compatible` (empty = rule-based coach only) |
| `AI_API_KEY` | Provider key — server-side only, never sent to the client |
| `AI_MODEL` | Model name |
| `AI_BASE_URL` | Required for `compatible` (e.g. local model server) |
| `AI_MAX_TOKENS` | Cap per tutor reply (default 600) |
| `VITE_API_URL` | Server URL as seen by the browser |
| Client auth | Do not use `VITE_APP_TOKEN`; authentication uses the runtime login form |

## DB setup

SQLite file auto-created on first server start at `$DATA_DIR/chesstutor.sqlite`. Schema (`server/src/db/schema.sql`) is applied once via the `meta` version row; `server/src/db/seed.ts` inserts lessons, exercises, the 48 seed puzzles, and one mastery row per concept when tables are empty.

```bash
npm run db:migrate   # manual migration entrypoint (also runs on startup)
```

## Content scripts

```bash
node scripts/verify-content.mjs   # validate curriculum + puzzles with chess.js (exit 1 on failure)
node scripts/import-puzzles.mjs --max 5000 --min-rating 800 --max-rating 1800 --db server/data/chesstutor.sqlite
```

The import script streams the Lichess puzzle DB (`database.lichess.org`), filters by rating/theme, and inserts with `INSERT OR IGNORE`. Needs the `zstd` CLI. Run it **after** the app's first startup so the 48 hand-verified seed puzzles are not skipped by the empty-table seed guard.

## Build / test

```bash
npm run build   # shared -> server (tsc) -> client (vite)
npm run test    # vitest (server)
npm start       # node dist/index.js (server; serve client/dist separately)
```

## Deploy

Any Node host / VPS: `npm install && npm run build && npm start`. Serve `client/dist` as static files (or behind the same reverse proxy). Copy `.env` with `AI_API_KEY` set for the AI coach; without it the tutor falls back to a deterministic rule-based coach. SQLite needs a persistent volume for `$DATA_DIR`.

## License obligations (summary — see LICENSES.md)

- Stockfish: GPLv3, loaded at runtime from npm — not linked into distributed source.
- react-chessboard: GPLv3 (client web app).
- chess.js: BSD-2. Fastify / Tailwind: MIT.
- Lichess puzzle data: public domain / CC0 per database.lichess.org.

## Security for Codespaces or a hosted app

The devcontainer requests **private** port forwarding. An already-running
Codespace may still have a previously selected **public** port. Verify in the
Codespaces Ports panel that 3101 is Private; changing devcontainer.json alone
does not change the current forwarded port. Public access without APP_TOKEN
exposes all games, learning history and write endpoints.

On remotely reachable hosting, set a strong random APP_TOKEN in the **server**
environment. Enter it in the app's access screen. It is exchanged for a
one-day HttpOnly SameSite=Strict cookie and never embedded in the frontend.
Changing APP_TOKEN invalidates sessions. The original bearer header still
works for scripted API clients.

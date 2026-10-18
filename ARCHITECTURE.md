# Architecture

## System diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Browser (React + Vite + Tailwind)                           │
│  - react-chessboard board UI                                │
│  - Stockfish WASM browser runtime  ← client-side analysis          │
│  - sends FEN + engine read to server for tutor context      │
└───────────────┬─────────────────────────────────────────────┘
                │  HTTP JSON (/api/*)
┌───────────────▼─────────────────────────────────────────────┐
│ Node + Fastify server                                       │
│  routes.ts        REST API (lessons, exercises, puzzles,    │
│                   sessions, games, tutor chat, dashboard)   │
│  learning.ts      deterministic mastery/progression math    │
│  ai.ts            provider abstraction (openai/anthropic/   │
│                   compatible); chess.js validates AI moves  │
│  chess.ts         chess helpers (PGN parse, eval plumbing) │
│  db/              node:sqlite, schema.sql, seed.ts          │
│  data/            curriculum.ts, seed-puzzles.ts            │
└───────────────┬─────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────┐
│ SQLite file (server/data/chesstutor.sqlite, WAL mode)       │
└─────────────────────────────────────────────────────────────┘
```

## Module responsibilities

- `shared/src/index.ts` — single source of truth: 15-concept taxonomy, `Exercise`/`Lesson`/`Puzzle` types, API contract. Both client and server import it; nothing else defines these shapes.
- `server/src/routes.ts` — all HTTP handlers, game-analysis pipeline (`classify`, `linkConcepts`), tutor-chat orchestration.
- `server/src/learning.ts` — ALL mastery/progression math. Pure functions, unit-tested. The LLM never sets mastery.
- `server/src/ai.ts` — AI provider abstraction; every move string the model emits is validated against the position with chess.js before it reaches the client (`validatedMoves`).
- `server/src/chess.ts` — chess utilities (PGN import parsing, engine-result plumbing).
- `server/src/db/` — `node:sqlite` wrapper, `schema.sql` (v1), `seed.ts` (idempotent curriculum/puzzle/mastery seeding).
- `server/src/data/` — content: `curriculum.ts` (15 lessons + 60 exercises), `seed-puzzles.ts` (48 hand-verified puzzles).
- `scripts/` — `verify-content.mjs` (chess.js content validation), `import-puzzles.mjs` (Lichess DB subset import).

## Data flow

1. Client requests lesson/exercise/puzzle → server reads SQLite → JSON.
2. Learner attempts a move → client sends attempt → server updates mastery via `learning.ts`, schedules spaced review.
3. Game analysis: PGN upload → server parses → client Stockfish WASM produces evals → server classifies moves (`classify`) and links concepts (`linkConcepts`) → stored in `game_moves`.
4. Tutor chat: client sends messages + FEN + optional engine read → server injects learner context (weak concepts, never client-claimed mastery) → provider → chess.js validates any moves in the reply → client.

## Stockfish WASM browser runtime

The engine runs entirely in the browser (Stockfish() WASM factory with vendor-managed worker threads; loaded from /engine/stockfish.js). No server CPU is spent on analysis, no engine traffic crosses the network, and analysis works offline once loaded. The client may attach its engine read (`bestUci`, `evalCp`, `depth`) to tutor-chat requests as context.

## Server AI provider abstraction

`ai.ts` supports `openai`, `anthropic`, and `compatible` (any OpenAI-compatible endpoint, e.g. a local model server) via `AI_PROVIDER`/`AI_API_KEY`/`AI_MODEL`/`AI_BASE_URL`. Keys live server-side only. If no provider is configured, the tutor falls back to a deterministic rule-based coach (`coachLiteReply`) built from engine data + weak concepts — the app is fully usable without an API key.

## SQLite schema overview

See `server/src/db/schema.sql` (v1). Key tables:

- `lessons`, `exercises`, `puzzles` — content (JSON columns for arrays)
- `mastery` — one row per concept: `mastery` (0.02–0.98), `attempts`, `streak`, `next_review_at`
- `exercise_attempts`, `puzzle_attempts` — attempt history with outcomes
- `daily_sessions` — planned/completed session steps
- `imported_games`, `game_moves` — PGN imports + per-move analysis (`eval_cp`, `cp_loss`, `classification`, `concept_links`)

## Architecture decisions

(a) **Node + Fastify + SQLite over Cloudflare Workers + D1.** Chosen for local-first single-user simplicity: zero-config persistence (a file), no vendor lock-in, trivial backup, and a codebase a single engineer (or ChatGPT) can hold in their head. D1/Workers would add deployment complexity for no benefit at this scale.

(b) **Engine client-side in a Web Worker.** Analysis is embarrassingly parallel to the UI and CPU-heavy; running Stockfish in the browser keeps the server stateless and cheap, avoids shipping positions to a third party, and lets analysis continue while the server is idle.

(c) **AI server-side with chess.js validation.** API keys must never reach the browser, and LLMs hallucinate illegal moves. The server injects trusted learner context and validates every move string in the model's reply against the actual FEN with chess.js; only validated moves are returned (`validatedMoves`).

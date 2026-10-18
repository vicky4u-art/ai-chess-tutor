# Handoff — AI Chess Tutor

Written for a competent engineer (ChatGPT) with no access to the original build conversation. Everything below is verified against the repo as of 2026-10-18.

## What it is

Single-user, local-first AI chess tutor. Adaptive lessons + exercises across 15 chess concepts, puzzles, PGN game analysis with concept-linked mistakes, spaced-repetition reviews, daily session planner, and an AI coach chat. Deterministic learning engine; the LLM never sets mastery scores.

## Repo layout

```
shared/src/index.ts        # concept taxonomy, types, API contract (DO NOT fork these shapes)
server/src/index.ts        # Fastify entrypoint
server/src/routes.ts       # all API handlers + game analysis (classify/linkConcepts)
server/src/learning.ts     # mastery math + session planner (pure functions)
server/src/ai.ts           # AI provider abstraction + chess.js move validation
server/src/chess.ts        # chess helpers
server/src/db/             # node:sqlite wrapper, schema.sql (v1), seed.ts
server/src/data/           # curriculum.ts (15 lessons, 60 exercises), seed-puzzles.ts (48 puzzles)
server/tests/              # vitest: learning, chess, api
client/                    # React + Vite + Tailwind, react-chessboard, Stockfish Web Worker
scripts/verify-content.mjs # chess.js validation of all content (run in CI)
scripts/import-puzzles.mjs # Lichess puzzle DB subset importer
```

## Key modules / functions

- `learning.ts`: `updateMastery` (m <- m + k*(outcome-m), k=0.12/0.06/0.10), `estimatedStrength`, `difficultyBand` (±150), `planSession`, `pickNextPuzzle`, `assessmentSeed`
- `routes.ts`: `classify(cpLoss)` (80/150/300 thresholds), `linkConcepts` (sparse heuristics), tutor-chat handler, `coachLiteReply` (no-AI fallback)
- `ai.ts`: provider switch (openai/anthropic/compatible); validates model-emitted moves with chess.js → `validatedMoves`
- `db/seed.ts`: idempotent seeding; puzzles seed only when table is empty
- Content files use plain object literals + one type annotation so `verify-content.mjs` can load them without tsc

## Run locally

```bash
npm install
cp .env.example .env   # set AI_* only if you want the AI coach; app works without
npm run dev            # server :3001 + client
node scripts/verify-content.mjs   # content checks, exit 1 on failure
```

## Tests

```bash
npm run test           # vitest (server)
```

## Debug

- `GET /api/health` — server liveness (no auth)
- `GET /api/diagnostics` — version, AI-configured flag, DB row counts
- Export: copy `server/data/chesstutor.sqlite` (WAL mode — copy the -wal/-shm too, or checkpoint first)
- Content issues: run `verify-content.mjs`; it reports the exact failing FEN/move

## Known limitations (honest)

1. AI tutor needs an API key (`AI_PROVIDER` + `AI_API_KEY`); without it, only the rule-based coach replies.
2. Puzzle DB is the 48 hand-verified seeds until `import-puzzles.mjs` is run (needs `zstd` CLI; run after first startup so seeds aren't skipped).
3. Game import is PGN upload only — Chess.com/Lichess API import is not implemented (`ImportedGame.source` has the enum values but no fetchers).
4. No multi-user auth: single user, optional shared `APP_TOKEN` bearer.
5. One lesson level per concept (level 1); levels 2–3 are in the type but have no content.
6. `yes-no` exercises use pseudo-UCI `["yes"]`/`["no"]` — clients must render buttons, not a board move.

## Deployment

`npm run build && npm start` on any Node host; serve `client/dist` statically; persist `$DATA_DIR`. See README.md.

## Recommended next steps

1. Write level 2–3 lessons for each concept (same `curriculum.ts` format; extend `verify-content.mjs` word-count bounds if lessons get longer).
2. Run `import-puzzles.mjs` to grow the puzzle pool; consider theme→concept mapping for the planner.
3. Implement Lichess/Chess.com game fetch (OAuth) to replace manual PGN upload.
4. Add `assessmentSeed` UI flow — the engine supports it, the client may not expose it yet.
5. Client: confirm `yes-no` renders as buttons and `acceptableUci` is honored.

# Changelog

## 0.1.0 — 2026-10-18

Initial implementation.

- 15-concept skill taxonomy (`shared/src/index.ts`) with prerequisites
- Curriculum: 15 lessons (level 1, one per concept) + 60 exercises (4 per lesson; find-move / choose-move / yes-no), all FENs and solution lines verified with chess.js
- 48 hand-verified seed puzzles (23 mate-in-1, 4 mate-in-2, 21 tactics)
- Deterministic learning engine (`server/src/learning.ts`): mastery updates, difficulty bands, spaced repetition, assessment seeding, daily session planner
- Game analysis: PGN upload, per-move cp-loss classification, sparse concept-linking heuristics
- AI tutor: server-side provider abstraction (OpenAI / Anthropic / OpenAI-compatible) with chess.js validation of generated moves; rule-based fallback coach when no key is configured
- Client: React + Tailwind + react-chessboard, Stockfish in a Web Worker
- SQLite persistence (`node:sqlite`), idempotent seeding, WAL mode
- Scripts: `verify-content.mjs` (content validation), `import-puzzles.mjs` (Lichess DB subset importer)
- Docs: README, ARCHITECTURE, LEARNING_ENGINE, HANDOFF, LICENSES

## Unreleased
- Added .devcontainer/devcontainer.json: one-click GitHub Codespaces setup (Node 22, auto install+build, auto-start server on port 3101, public port forwarding) so the app can be used from a phone browser with no local machine.

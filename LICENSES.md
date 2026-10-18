# Licenses & third-party obligations

Short, accurate notices. Full license texts live in each package's own LICENSE file.

## Stockfish — GPLv3

The engine is loaded at runtime from the npm package inside the client (Web Worker / WASM); it is not compiled into or linked with the app's distributed source. Implication: if you distribute the built client, the GPLv3 applies to the engine binary — keep the Stockfish copyright/license notice intact and make the corresponding engine source available on request, per GPLv3. The app's own source remains under its own license; do not remove the runtime-loading separation.

## react-chessboard — GPLv3

The client is a web app that bundles this component. Implication: distributing the built client triggers GPLv3 obligations for the client bundle (provide source / license notice). Keep the license notice; if you relicense the client proprietarily, replace this component first.

## chess.js — BSD-2-Clause

Permissive. Keep the copyright notice in distributions.

## Fastify — MIT

Permissive. Keep the copyright notice.

## Tailwind CSS — MIT

Permissive. Keep the copyright notice.

## Lichess puzzle data — public domain / CC0

Per database.lichess.org, the puzzle database is released as public domain (CC0). No attribution required; attribution appreciated. The 48 seed puzzles in `server/src/data/seed-puzzles.ts` are hand-authored for this project. Puzzles imported via `scripts/import-puzzles.mjs` inherit the CC0 status of the Lichess dataset.

## Fonts / assets

No third-party fonts or image assets are bundled. If you add any, record their licenses here.

#!/usr/bin/env node
/**
 * verify-content.mjs — validates curriculum.ts and seed-puzzles.ts with chess.js.
 *
 * Run from the repo root after `npm install`:
 *   node scripts/verify-content.mjs
 *
 * Checks:
 *  - every FEN parses
 *  - every solutionUci move is legal in sequence (skipped for yes-no pseudo-moves)
 *  - hints length is exactly 3
 *  - choose-move has 4 legal choices and the solution is among them
 *  - mate puzzles end in checkmate
 *  - lesson exerciseIds all resolve, 4 per lesson, conceptIds match
 *  - lesson contentMd is 100-400 words (warns outside 150-300)
 *  - ids unique, ratings/difficulties in range, themes present
 *
 * Loading TS without a compiler: the data files use plain object literals
 * plus `import type` and `export const X: T[] =` annotations only, so we
 * strip those with regex and evaluate. If the data files ever use richer
 * TS syntax, switch this loader to `npx tsx`.
 *
 * Exit code 0 = all checks pass; 1 = any failure (with a clear report).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Resolve chess.js: prefer hoisted root install, fall back to server/node_modules.
let Chess;
try {
  ({ Chess } = await import("chess.js"));
} catch {
  ({ Chess } = await import(join(root, "server", "node_modules", "chess.js")));
}

/** Load a `export const NAME: T[] = [...]` from a TS data file without compiling. */
function loadTsArray(file, name) {
  let src = readFileSync(join(root, file), "utf8");
  src = src.replace(/^import type .*$/gm, ""); // drop type-only imports
  src = src.replace(/export const (\w+): \w+\[\] =/g, "const $1 ="); // strip type annotation
  const fn = new Function(`${src}; return { ${name} };`);
  const out = fn()[name];
  if (!Array.isArray(out)) throw new Error(`Could not load ${name} from ${file}`);
  return out;
}

const LESSONS = loadTsArray("server/src/data/curriculum.ts", "LESSONS");
const EXERCISES = loadTsArray("server/src/data/curriculum.ts", "EXERCISES");
const SEED_PUZZLES = loadTsArray("server/src/data/seed-puzzles.ts", "SEED_PUZZLES");

const failures = [];
const warnings = [];
const fail = (msg) => failures.push(msg);
const warn = (msg) => warnings.push(msg);

/** Play UCI moves in sequence; returns { ok, error?, chess } . */
function playMoves(fen, ucis) {
  let c;
  try {
    c = new Chess(fen);
  } catch (e) {
    return { ok: false, error: `FEN parse failed: ${e.message}` };
  }
  for (const u of ucis) {
    try {
      c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    } catch {
      return { ok: false, error: `move ${u} illegal in: ${c.fen()}` };
    }
  }
  return { ok: true, chess: c };
}

const isYesNo = (e) => e.kind === "yes-no";

// ---------------- Exercises ----------------
{
  const seen = new Set();
  const validKinds = new Set(["find-move", "choose-move", "yes-no"]);
  for (const e of EXERCISES) {
    const tag = `exercise ${e.id || "(missing id)"}`;
    if (!e.id || seen.has(e.id)) fail(`${tag}: duplicate or missing id`);
    seen.add(e.id);
    if (!validKinds.has(e.kind)) fail(`${tag}: bad kind ${e.kind}`);
    if (typeof e.prompt !== "string" || !e.prompt.trim()) fail(`${tag}: empty prompt`);
    if (!Array.isArray(e.solutionUci) || e.solutionUci.length === 0) fail(`${tag}: empty solutionUci`);
    if (!Array.isArray(e.hints) || e.hints.length !== 3 || e.hints.some((h) => typeof h !== "string" || !h.trim()))
      fail(`${tag}: hints must be exactly 3 non-empty strings`);
    if (typeof e.explanation !== "string" || !e.explanation.trim()) fail(`${tag}: empty explanation`);
    if (typeof e.difficulty !== "number" || e.difficulty < 0 || e.difficulty > 100)
      fail(`${tag}: difficulty out of range 0-100`);

    if (isYesNo(e)) {
      if (e.solutionUci.length !== 1 || !["yes", "no"].includes(e.solutionUci[0]))
        fail(`${tag}: yes-no solutionUci must be ["yes"] or ["no"]`);
      // Still require a parsable FEN so the board renders.
      try {
        new Chess(e.fen);
      } catch (err) {
        fail(`${tag}: FEN parse failed: ${err.message}`);
      }
      continue;
    }

    const r = playMoves(e.fen, e.solutionUci);
    if (!r.ok) fail(`${tag}: ${r.error}`);

    if (e.kind === "choose-move") {
      if (!Array.isArray(e.choices) || e.choices.length !== 4)
        fail(`${tag}: choose-move needs exactly 4 choices`);
      else {
        if (!e.choices.includes(e.solutionUci[0]))
          fail(`${tag}: solution ${e.solutionUci[0]} not among choices`);
        for (const ch of e.choices) {
          const cr = playMoves(e.fen, [ch]);
          if (!cr.ok) fail(`${tag}: choice ${ch} illegal: ${cr.error}`);
        }
      }
    }

    if (e.acceptableUci) {
      for (const alt of e.acceptableUci) {
        const ar = playMoves(e.fen, alt);
        if (!ar.ok) fail(`${tag}: acceptableUci ${JSON.stringify(alt)} illegal: ${ar.error}`);
      }
    }
  }
}

// ---------------- Lessons ----------------
{
  const seen = new Set();
  const conceptIds = new Set();
  const byConcept = new Map();
  for (const l of LESSONS) {
    const tag = `lesson ${l.id || "(missing id)"}`;
    if (!l.id || seen.has(l.id)) fail(`${tag}: duplicate or missing id`);
    seen.add(l.id);
    if (conceptIds.has(l.conceptId)) fail(`${tag}: duplicate conceptId ${l.conceptId}`);
    conceptIds.add(l.conceptId);
    for (const f of ["title", "objective", "contentMd"])
      if (typeof l[f] !== "string" || !l[f].trim()) fail(`${tag}: empty ${f}`);
    const words = (l.contentMd || "").split(/\s+/).filter(Boolean).length;
    if (words < 100 || words > 400) fail(`${tag}: contentMd ${words} words (expected 100-400)`);
    else if (words < 150 || words > 300) warn(`${tag}: contentMd ${words} words (target 150-300)`);
    if (!Array.isArray(l.exerciseIds) || l.exerciseIds.length !== 4)
      fail(`${tag}: expected exactly 4 exerciseIds, got ${(l.exerciseIds || []).length}`);
    byConcept.set(l.conceptId, l);
  }
  if (LESSONS.length !== 15) fail(`expected 15 lessons, got ${LESSONS.length}`);

  const exById = new Map(EXERCISES.map((e) => [e.id, e]));
  const exCount = new Map();
  for (const l of LESSONS) {
    for (const eid of l.exerciseIds || []) {
      const e = exById.get(eid);
      if (!e) fail(`lesson ${l.id}: exerciseId ${eid} does not resolve`);
      else if (e.conceptId !== l.conceptId)
        fail(`lesson ${l.id}: exercise ${eid} has conceptId ${e.conceptId}`);
      exCount.set(eid, (exCount.get(eid) || 0) + 1);
    }
  }
  for (const e of EXERCISES) {
    if (!exCount.has(e.id)) fail(`exercise ${e.id} is not referenced by any lesson`);
    if (exCount.get(e.id) > 1) fail(`exercise ${e.id} referenced by multiple lessons`);
  }
  if (EXERCISES.length !== 60) fail(`expected 60 exercises, got ${EXERCISES.length}`);
}

// ---------------- Seed puzzles ----------------
{
  const seen = new Set();
  for (const p of SEED_PUZZLES) {
    const tag = `puzzle ${p.id || "(missing id)"}`;
    if (!p.id || seen.has(p.id)) fail(`${tag}: duplicate or missing id`);
    seen.add(p.id);
    if (p.sourceId !== "seed") fail(`${tag}: sourceId should be "seed"`);
    if (typeof p.rating !== "number" || p.rating < 600 || p.rating > 1800)
      fail(`${tag}: rating ${p.rating} outside 600-1800`);
    if (!Array.isArray(p.themes) || p.themes.length === 0) fail(`${tag}: empty themes`);

    const r = playMoves(p.fen, p.solutionUci);
    if (!r.ok) {
      fail(`${tag}: ${r.error}`);
      continue;
    }
    const isMatePuzzle = p.themes.includes("mate");
    if (isMatePuzzle && !r.chess.isCheckmate())
      fail(
        `${tag}: expected checkmate, final: ${r.chess.fen()} (check=${r.chess.isCheck()}, stalemate=${r.chess.isStalemate()})`
      );
  }
  if (SEED_PUZZLES.length !== 48) fail(`expected 48 seed puzzles, got ${SEED_PUZZLES.length}`);
  // ids seed-001..seed-048 present
  for (let i = 1; i <= 48; i++) {
    const id = `seed-${String(i).padStart(3, "0")}`;
    if (!seen.has(id)) fail(`missing puzzle id ${id}`);
  }
}

// ---------------- Report ----------------
console.log(`Lessons: ${LESSONS.length}, Exercises: ${EXERCISES.length}, Seed puzzles: ${SEED_PUZZLES.length}`);
for (const w of warnings) console.log(`WARN: ${w}`);
if (failures.length) {
  console.log(`\n${failures.length} FAILURE(S):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("All content checks passed.");

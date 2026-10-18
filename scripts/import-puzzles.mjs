#!/usr/bin/env node
/**
 * import-puzzles.mjs — import a curated subset of the Lichess puzzle database.
 *
 * Usage:
 *   node scripts/import-puzzles.mjs [--max N] [--min-rating R] [--max-rating R]
 *                                    [--themes t1,t2] [--db PATH] [--input PATH]
 *                                    [--url URL]
 *
 * Downloads (or reads) the official Lichess puzzle database
 *   https://database.lichess.org/lichess_db_puzzle.csv.zst
 * filters by rating band + theme allowlist, caps the count, and inserts
 * into the app's SQLite `puzzles` table (node:sqlite, same as the server).
 *
 * CSV columns (per database.lichess.org; header is parsed by name):
 *   PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
 * - FEN is the position to solve FROM (side to move = the learner).
 * - Moves are space-separated UCI; Moves[0] is the learner's first solution
 *   move, followed by opponent replies and further solution moves.
 *   VERIFIED: this matches the Lichess puzzle format documented at
 *   database.lichess.org and the `puzzles` table convention used by
 *   server/src/data/seed-puzzles.ts (full line stored in solution_uci).
 *   ASSUMED (not re-verified against a fresh download): the exact header
 *   spelling. The script parses the header row by name and fails clearly
 *   if PuzzleId/FEN/Moves/Rating/Themes are missing.
 *
 * Decompression: streams through the `zstd` CLI (`zstd -d -c`).
 *   Install: `apt install zstd` / `brew install zstd`.
 *   Or pass --input pointing at an already-decompressed .csv.
 *
 * Idempotency: INSERT OR IGNORE on id (`lichess-{PuzzleId}`), so re-runs
 * are safe. NOTE: server/src/db/seed.ts only inserts the 48 hand-verified
 * seeds when the puzzles table is EMPTY. Run this import AFTER the app's
 * first startup (or re-insert seeds manually) so the seeds are not skipped.
 */
import { createReadStream, existsSync } from "node:fs";
import { get } from "node:https";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_URL = "https://database.lichess.org/lichess_db_puzzle.csv.zst";
const DEFAULT_DB = join(root, "server", "data", "chesstutor.sqlite");
// Sensible default theme allowlist: basic tactics + mates, no exotic motifs.
const DEFAULT_THEMES = [
  "mate", "mateIn1", "mateIn2", "hangingPiece", "fork", "pin",
  "skewer", "discoveredAttack", "doubleCheck", "deflection",
];

function parseArgs(argv) {
  const o = {
    max: 5000, minRating: 800, maxRating: 1800,
    themes: DEFAULT_THEMES, db: DEFAULT_DB, input: null, url: DEFAULT_URL,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    if (a === "--max") o.max = parseInt(v, 10), i++;
    else if (a === "--min-rating") o.minRating = parseInt(v, 10), i++;
    else if (a === "--max-rating") o.maxRating = parseInt(v, 10), i++;
    else if (a === "--themes") o.themes = v.split(",").map((s) => s.trim()).filter(Boolean), i++;
    else if (a === "--db") o.db = v, i++;
    else if (a === "--input") o.input = v, i++;
    else if (a === "--url") o.url = v, i++;
    else if (a === "--help") { console.log(HELP); process.exit(0); }
    else { console.error(`Unknown flag ${a}\n${HELP}`); process.exit(2); }
  }
  return o;
}

const HELP = `Usage: node scripts/import-puzzles.mjs [flags]
  --max N            cap imported puzzles (default 5000)
  --min-rating R     minimum puzzle rating (default 800)
  --max-rating R     maximum puzzle rating (default 1800)
  --themes t1,t2     theme allowlist, puzzle needs >=1 (default: basic tactics+mates)
  --db PATH          SQLite file (default server/data/chesstutor.sqlite)
  --input PATH       local .zst or .csv file (skips download)
  --url URL          override download URL`;

/** Split one CSV row on commas (Lichess puzzle CSV has no quoted commas). */
function splitRow(line) {
  return line.split(",");
}

async function* linesOf(input, isZst) {
  let stream;
  if (input === "stdin-url") throw new Error("unreachable");
  if (isZst) {
    const zstd = spawn("zstd", ["-d", "-c", input], { stdio: ["ignore", "pipe", "inherit"] });
    zstd.on("error", (e) => {
      console.error(`Failed to run \`zstd\`: ${e.message}. Install zstd or pass --input with a decompressed .csv.`);
      process.exit(3);
    });
    stream = zstd.stdout;
  } else {
    stream = createReadStream(input);
  }
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) yield line;
}

function downloadToStdout(url) {
  // Returns a readable stream of the (still compressed) response body.
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(downloadToStdout(res.headers.location));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        return;
      }
      resolve(res);
    }).on("error", reject);
  });
}

async function* linesOfUrl(url) {
  const body = await downloadToStdout(url);
  const zstd = spawn("zstd", ["-d", "-c"], { stdio: ["pipe", "pipe", "inherit"] });
  zstd.on("error", (e) => {
    console.error(`Failed to run \`zstd\`: ${e.message}. Install zstd first.`);
    process.exit(3);
  });
  body.pipe(zstd.stdin);
  const rl = createInterface({ input: zstd.stdout, crlfDelay: Infinity });
  for await (const line of rl) yield line;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  console.log(`Importing puzzles: rating ${o.minRating}-${o.maxRating}, themes [${o.themes.join(",")}], max ${o.max}`);

  const db = new DatabaseSync(o.db);
  db.exec(`CREATE TABLE IF NOT EXISTS puzzles (
    id TEXT PRIMARY KEY, source_id TEXT NOT NULL, fen TEXT NOT NULL,
    solution_uci TEXT NOT NULL, rating REAL NOT NULL, themes TEXT NOT NULL
  )`);
  const insert = db.prepare(
    `INSERT OR IGNORE INTO puzzles (id, source_id, fen, solution_uci, rating, themes)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const lines = o.input
    ? linesOf(o.input, o.input.endsWith(".zst"))
    : linesOfUrl(o.url);

  let header = null;
  let col = {};
  let seen = 0, kept = 0, inserted = 0;
  db.exec("BEGIN");
  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      if (!header) {
        header = splitRow(line);
        for (const need of ["PuzzleId", "FEN", "Moves", "Rating", "Themes"]) {
          const i = header.indexOf(need);
          if (i === -1) throw new Error(`CSV header missing column "${need}". Got: ${header.join(",")}`);
          col[need] = i;
        }
        continue;
      }
      seen++;
      const f = splitRow(line);
      const rating = parseInt(f[col.Rating], 10);
      if (Number.isNaN(rating) || rating < o.minRating || rating > o.maxRating) continue;
      const themes = (f[col.Themes] || "").split(" ").filter(Boolean);
      if (!themes.some((t) => o.themes.includes(t))) continue;
      const moves = (f[col.Moves] || "").split(" ").filter(Boolean);
      if (moves.length === 0) continue;
      const id = `lichess-${f[col.PuzzleId]}`;
      const r = insert.run(id, "lichess", f[col.FEN], JSON.stringify(moves), rating, JSON.stringify(themes));
      if (r.changes > 0) inserted++;
      kept++;
      if (kept >= o.max) break;
      if (kept % 1000 === 0) console.log(`  ...${kept} kept (${inserted} new)`);
    }
    db.exec("COMMIT");
  } catch (e) {
    try { db.exec("ROLLBACK"); } catch { /* ignore */ }
    throw e;
  }
  console.log(`Done. Scanned ${seen} rows, kept ${kept}, inserted ${inserted} new (max ${o.max}).`);
  db.close();
}

main().catch((e) => { console.error(`import-puzzles failed: ${e.message}`); process.exit(1); });

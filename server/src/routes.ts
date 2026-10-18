/** All API routes. Keep handlers thin; math lives in learning.ts, chess in chess.ts. */
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { transaction } from './db/index.js';
import { Chess } from 'chess.js';
import {
  API_VERSION,
  AssessmentResult,
  AttemptOutcome,
  CONCEPTS,
  ConceptId,
  DailySession,
  DashboardData,
  Exercise,
  GameMove,
  MasteryRecord,
  Puzzle,
  TutorChatResponse,
  emptyMastery,
} from '@chesstutor/shared';
import { updateMastery, assessmentSeed, planSession, pickNextPuzzle, difficultyBand } from './learning.js';
import { parsePgn, extractUciMoves, validatedMoves, isLegalSequence } from './chess.js';
import { loadAiConfig, chatCompletion, tutorSystemPrompt, ChatMsg } from './ai.js';
import { fetchChesscomGames, extractGameLink, normalizeUsername } from './chesscom.js';

// ---------------------------------------------------------------- helpers

type Row = Record<string, unknown>;

function j<T>(v: unknown): T {
  return JSON.parse(v as string) as T;
}
function jj(v: unknown): string {
  return JSON.stringify(v);
}
function nowIso(): string {
  return new Date().toISOString();
}

function getMastery(db: DatabaseSync): MasteryRecord[] {
  const rows = db.prepare(`SELECT * FROM mastery`).all() as Row[];
  const byId = new Map(rows.map((r) => [r.concept_id as string, r]));
  return CONCEPTS.map((c) => {
    const r = byId.get(c.id);
    return r
      ? {
          conceptId: c.id,
          mastery: r.mastery as number,
          attempts: r.attempts as number,
          independentSuccesses: r.independent_successes as number,
          lastSeenAt: (r.last_seen_at as string) ?? null,
          nextReviewAt: (r.next_review_at as string) ?? null,
        }
      : emptyMastery(c.id);
  });
}

function saveMastery(db: DatabaseSync, m: MasteryRecord, streak: number): void {
  db.prepare(
    `UPDATE mastery SET mastery=?, attempts=?, independent_successes=?, streak=?, last_seen_at=?, next_review_at=?
     WHERE concept_id=?`,
  ).run(m.mastery, m.attempts, m.independentSuccesses, streak, m.lastSeenAt, m.nextReviewAt, m.conceptId);
}

function getExercise(db: DatabaseSync, id: string): Exercise & { _row: true } {
  const r = db.prepare(`SELECT * FROM exercises WHERE id=?`).get(id) as Row | undefined;
  if (!r) throw Object.assign(new Error(`Exercise ${id} not found`), { statusCode: 404 });
  return {
    _row: true,
    id: r.id as string,
    conceptId: r.concept_id as ConceptId,
    kind: r.kind as Exercise['kind'],
    fen: r.fen as string,
    prompt: r.prompt as string,
    solutionUci: j(r.solution_uci),
    acceptableUci: r.acceptable_uci ? j(r.acceptable_uci) : undefined,
    choices: r.choices ? j(r.choices) : undefined,
    hints: j(r.hints),
    explanation: r.explanation as string,
    difficulty: r.difficulty as number,
  };
}

function exercisePublic(e: ReturnType<typeof getExercise>): Exercise {
  const { _row, ...rest } = e;
  void _row;
  return rest;
}

function getPuzzle(db: DatabaseSync, id: string): Puzzle {
  const r = db.prepare(`SELECT * FROM puzzles WHERE id=?`).get(id) as Row | undefined;
  if (!r) throw Object.assign(new Error(`Puzzle ${id} not found`), { statusCode: 404 });
  return {
    id: r.id as string,
    sourceId: r.source_id as string,
    fen: r.fen as string,
    solutionUci: j(r.solution_uci),
    rating: r.rating as number,
    themes: j(r.themes),
  };
}

function sanLine(fen: string, ucis: string[]): string {
  const chess = new Chess(fen);
  const sans: string[] = [];
  for (const uci of ucis) {
    const mv = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    if (!mv) break;
    sans.push(mv.san);
  }
  return sans.join(' ');
}

/** Deterministic graduated hints + explanation for a puzzle. */
function puzzleHelp(p: Puzzle): { hints: [string, string, string]; explanation: string } {
  const first = p.solutionUci[0] ?? '';
  const target = first.slice(2, 4).toUpperCase();
  const themes = p.themes.join(' ').toLowerCase();
  const isMate = themes.includes('mate');
  const h1 = isMate
    ? 'There is a forced checkmate here. List every check you can give, then test whether the king can escape each one.'
    : 'There is a forcing tactic here. Look at checks, captures, and attacks in that order — forcing moves first.';
  const h2 = `The key idea involves the ${target} square. Which of your pieces can get there with tempo?`;
  let firstSan = first;
  try {
    const chess = new Chess(p.fen);
    const mv = chess.move({ from: first.slice(0, 2), to: first.slice(2, 4), promotion: first[4] });
    if (mv) firstSan = mv.san;
  } catch { /* keep uci */ }
  const h3 = `Play ${firstSan}, then follow the forcing line.`;
  const explanation = isMate
    ? `The solution is ${sanLine(p.fen, p.solutionUci)} — a forced mating sequence.`
    : `The solution is ${sanLine(p.fen, p.solutionUci)}, winning decisive material or advantage.`;
  return { hints: [h1, h2, h3], explanation };
}

function puzzleResponse(p: Puzzle) {
  const { hints, explanation } = puzzleHelp(p);
  return { ...p, hints, explanation };
}

function deriveOutcome(body: {
  outcome?: AttemptOutcome;
  correct?: boolean;
  playedUci?: string;
  hintsUsed?: number;
}): AttemptOutcome {
  // A client's claimed outcome never overrides the server's move check.
  if (body.outcome === 'shown' || !body.correct) return 'shown';
  return (body.hintsUsed ?? 0) > 0 ? 'hinted' : 'independent';
}

function checkCorrect(ex: { solutionUci: string[]; acceptableUci?: string[][] }, playedUci?: string): boolean {
  if (!playedUci) return false;
  if (ex.solutionUci[0] === playedUci) return true;
  return (ex.acceptableUci ?? []).some((alt) => alt[0] === playedUci);
}

// ---------------------------------------------------------------- routes

export function registerRoutes(app: FastifyInstance, db: DatabaseSync): void {
  // ---- health & diagnostics (no auth) ----
  app.get('/api/health', async () => ({ status: 'ok', version: API_VERSION }));

  app.get('/api/diagnostics', async () => {
    const counts: Record<string, number> = {};
    for (const t of ['lessons', 'exercises', 'puzzles', 'games', 'sessions', 'exercise_attempts', 'puzzle_attempts']) {
      counts[t] = (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as Row).n as number;
    }
    return {
      version: API_VERSION,
      aiConfigured: loadAiConfig() !== null,
      engine: 'client-side-stockfish-wasm',
      serverTime: nowIso(),
      counts,
    };
  });

  // ---- profile ----
  app.get('/api/profile', async () => {
    const r = db.prepare(`SELECT display_name, created_at FROM profile WHERE id=1`).get() as Row;
    return { displayName: r.display_name, createdAt: r.created_at };
  });
  app.put<{ Body: { displayName?: string } }>('/api/profile', async (req) => {
    const name = (req.body.displayName ?? '').trim().slice(0, 60) || 'Player';
    db.prepare(`UPDATE profile SET display_name=? WHERE id=1`).run(name);
    return { displayName: name };
  });

  // ---- concepts & lessons ----
  app.get('/api/concepts', async () => {
    const mastery = getMastery(db);
    const byId = new Map(mastery.map((m) => [m.conceptId, m]));
    return CONCEPTS.map((c) => ({ ...c, mastery: byId.get(c.id) ?? emptyMastery(c.id) }));
  });

  app.get<{ Querystring: { conceptId?: string } }>('/api/lessons', async (req) => {
    const { conceptId } = req.query;
    const rows = (
      conceptId
        ? db.prepare(`SELECT * FROM lessons WHERE concept_id=? ORDER BY level`).all(conceptId)
        : db.prepare(`SELECT * FROM lessons ORDER BY concept_id, level`).all()
    ) as Row[];
    return rows.map((r) => ({
      id: r.id, conceptId: r.concept_id, level: r.level, title: r.title,
      objective: r.objective, contentMd: r.content_md, exerciseIds: j(r.exercise_ids),
    }));
  });

  app.get<{ Params: { id: string } }>('/api/lessons/:id', async (req) => {
    const r = db.prepare(`SELECT * FROM lessons WHERE id=?`).get(req.params.id) as Row | undefined;
    if (!r) throw Object.assign(new Error('Lesson not found'), { statusCode: 404 });
    const exerciseIds = j<string[]>(r.exercise_ids);
    return {
      lesson: {
        id: r.id, conceptId: r.concept_id, level: r.level, title: r.title,
        objective: r.objective, contentMd: r.content_md, exerciseIds,
      },
      exercises: exerciseIds.map((id) => exercisePublic(getExercise(db, id))),
    };
  });

  app.get<{ Params: { id: string } }>('/api/exercises/:id', async (req) => {
    return exercisePublic(getExercise(db, req.params.id));
  });

  app.post<{ Params: { id: string }; Body: { outcome?: AttemptOutcome; playedUci?: string; correct?: boolean; hintsUsed?: number; timeMs?: number; sessionId?: string } }>(
    '/api/exercises/:id/attempt',
    async (req) => {
      const ex = getExercise(db, req.params.id);
      const b = req.body ?? {};
      const correct = b.outcome !== 'shown' && checkCorrect(ex, b.playedUci);
      const outcome = deriveOutcome({ ...b, correct });
      db.prepare(
        `INSERT INTO exercise_attempts (id, exercise_id, session_id, outcome, hints_used, time_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(randomUUID(), ex.id, b.sessionId ?? null, outcome, b.hintsUsed ?? 0, b.timeMs ?? 0, nowIso());
      const prev = getMastery(db).find((m) => m.conceptId === ex.conceptId) ?? emptyMastery(ex.conceptId);
      const streakRow = db.prepare(`SELECT streak FROM mastery WHERE concept_id=?`).get(ex.conceptId) as Row;
      const { record: updated, streak: newStreak } = updateMastery(prev, (streakRow?.streak as number) ?? 0, outcome);
      saveMastery(db, updated, newStreak);
      snapshotToday(db);
      return { correct, outcome, mastery: updated };
    },
  );

  // ---- assessment ----
  app.post('/api/assessment/start', async () => {
    // Fixed 15-item form: one per concept, spread across difficulty tiers.
    // (Within-run adaptivity is a documented limitation; repeats re-target the band.)
    const all = db.prepare(`SELECT * FROM exercises ORDER BY difficulty`).all() as Row[];
    const items: { exerciseId: string; conceptId: ConceptId; difficulty: number }[] = [];
    for (const c of CONCEPTS) {
      const pool = all.filter((r) => r.concept_id === c.id);
      if (!pool.length) continue;
      // pick the median-difficulty exercise for a balanced first read
      const mid = pool[Math.floor(pool.length / 2)];
      items.push({ exerciseId: mid.id as string, conceptId: c.id, difficulty: mid.difficulty as number });
    }
    const assessmentId = randomUUID();
    db.prepare(`INSERT INTO assessments (id, started_at, items) VALUES (?, ?, ?)`)
      .run(assessmentId, nowIso(), jj(items));
    return {
      assessmentId,
      items,
      exercises: items.map((i) => exercisePublic(getExercise(db, i.exerciseId))),
    };
  });

  app.post<{ Body: { assessmentId: string; exerciseId: string; playedUci?: string; correct?: boolean; outcome?: AttemptOutcome; hintsUsed?: number; timeMs?: number } }>(
    '/api/assessment/answer',
    async (req) => {
      const b = req.body;
      const ex = getExercise(db, b.exerciseId);
      const correct = b.outcome !== 'shown' && checkCorrect(ex, b.playedUci);
      const outcome = deriveOutcome({ ...b, correct });
      db.prepare(
        `INSERT INTO assessment_answers (assessment_id, exercise_id, outcome, hints_used, time_ms)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(assessment_id, exercise_id) DO UPDATE SET outcome=excluded.outcome, hints_used=excluded.hints_used, time_ms=excluded.time_ms`,
      ).run(b.assessmentId, b.exerciseId, outcome, b.hintsUsed ?? 0, b.timeMs ?? 0);
      return { correct, expectedUci: ex.solutionUci };
    },
  );

  app.post<{ Body: { assessmentId: string } }>('/api/assessment/finish', async (req) => {
    const a = db.prepare(`SELECT * FROM assessments WHERE id=?`).get(req.body.assessmentId) as Row | undefined;
    if (!a) throw Object.assign(new Error('Assessment not found'), { statusCode: 404 });
    const answers = db.prepare(`SELECT * FROM assessment_answers WHERE assessment_id=?`).all(req.body.assessmentId) as Row[];
    const items = j<{ exerciseId: string; conceptId: ConceptId }[]>(a.items);
    const byConcept = new Map<ConceptId, number[]>();
    for (const ans of answers) {
      const item = items.find((i) => i.exerciseId === ans.exercise_id);
      if (!item) continue;
      const list = byConcept.get(item.conceptId) ?? [];
      list.push(assessmentSeed(ans.outcome as AttemptOutcome));
      byConcept.set(item.conceptId, list);
    }
    const now = new Date();
    for (const [conceptId, seeds] of byConcept) {
      const avg = seeds.reduce((s, v) => s + v, 0) / seeds.length;
      const prev = getMastery(db).find((m) => m.conceptId === conceptId) ?? emptyMastery(conceptId);
      const merged: MasteryRecord = {
        ...prev,
        mastery: Math.round(((prev.mastery + avg) / 2) * 1000) / 1000,
        attempts: prev.attempts + seeds.length,
        lastSeenAt: now.toISOString(),
        nextReviewAt: new Date(now.getTime() + 86400_000).toISOString(),
      };
      saveMastery(db, merged, 0);
    }
    db.prepare(`UPDATE assessments SET finished_at=? WHERE id=?`).run(nowIso(), req.body.assessmentId);
    const profile = getMastery(db);
    // Uncertain = fewer than 3 total data points across all activity.
    const counts = new Map<ConceptId, number>();
    for (const r of db.prepare(`SELECT exercise_id FROM exercise_attempts`).all() as Row[]) {
      const ex = db.prepare(`SELECT concept_id FROM exercises WHERE id=?`).get(r.exercise_id as string) as Row | undefined;
      if (ex) counts.set(ex.concept_id as ConceptId, (counts.get(ex.concept_id as ConceptId) ?? 0) + 1);
    }
    for (const ans of answers) {
      const item = items.find((i) => i.exerciseId === ans.exercise_id);
      if (item) counts.set(item.conceptId, (counts.get(item.conceptId) ?? 0) + 1);
    }
    const uncertain = CONCEPTS.map((c) => c.id).filter((id) => (counts.get(id) ?? 0) < 3);
    snapshotToday(db);
    const result: AssessmentResult = { assessmentId: req.body.assessmentId, finishedAt: nowIso(), profile, uncertain };
    return result;
  });

  // ---- sessions ----
  app.post<{ Body: { minutes?: number } }>('/api/sessions/start', async (req) => {
    const minutes = [10, 20, 30].includes(req.body.minutes ?? 0) ? (req.body.minutes as number) : 20;
    const mastery = getMastery(db);
    const lessons = (db.prepare(`SELECT id, concept_id, level FROM lessons`).all() as Row[]).map((r) => ({
      id: r.id as string, conceptId: r.concept_id as ConceptId, level: r.level as number,
    }));
    const exercises = (db.prepare(`SELECT id, concept_id, difficulty FROM exercises`).all() as Row[]).map((r) => ({
      id: r.id as string, conceptId: r.concept_id as ConceptId, difficulty: r.difficulty as number,
    }));
    const puzzles = (db.prepare(`SELECT id, rating FROM puzzles`).all() as Row[]).map((r) => ({
      id: r.id as string, rating: r.rating as number,
    }));
    const plan = planSession(mastery, minutes, lessons, exercises, puzzles);
    const id = randomUUID();
    db.prepare(`INSERT INTO sessions (id, minutes, started_at, status, plan, completed_steps) VALUES (?, ?, ?, 'active', ?, '[]')`)
      .run(id, minutes, nowIso(), jj(plan));
    const session: DailySession = { id, minutes, startedAt: nowIso(), status: 'active', plan, completedStepIndexes: [] };
    return session;
  });

  const getSession = (id: string): DailySession => {
    const r = db.prepare(`SELECT * FROM sessions WHERE id=?`).get(id) as Row | undefined;
    if (!r) throw Object.assign(new Error('Session not found'), { statusCode: 404 });
    return {
      id: r.id as string, minutes: r.minutes as number, startedAt: r.started_at as string,
      status: r.status as DailySession['status'], plan: j(r.plan), completedStepIndexes: j(r.completed_steps),
    };
  };

  app.get<{ Params: { id: string } }>('/api/sessions/:id', async (req) => getSession(req.params.id));
  app.post<{ Params: { id: string } }>('/api/sessions/:id/pause', async (req) => {
    db.prepare(`UPDATE sessions SET status='paused' WHERE id=?`).run(req.params.id);
    return getSession(req.params.id);
  });
  app.post<{ Params: { id: string } }>('/api/sessions/:id/resume', async (req) => {
    db.prepare(`UPDATE sessions SET status='active' WHERE id=?`).run(req.params.id);
    return getSession(req.params.id);
  });
  app.post<{ Params: { id: string }; Body: { stepIndex: number } }>('/api/sessions/:id/complete-step', async (req) => {
    const s = getSession(req.params.id);
    const done = new Set(s.completedStepIndexes);
    done.add(req.body.stepIndex);
    const arr = [...done].sort((a, b) => a - b);
    const status = arr.length >= s.plan.length ? 'completed' : s.status;
    db.prepare(`UPDATE sessions SET completed_steps=?, status=? WHERE id=?`).run(jj(arr), status, s.id);
    return getSession(s.id);
  });

  // ---- puzzles ----
  app.get<{ Querystring: { conceptId?: string } }>('/api/puzzles/next', async (req) => {
    const mastery = getMastery(db);
    const puzzles = (db.prepare(`SELECT id, rating FROM puzzles`).all() as Row[]).map((r) => ({
      id: r.id as string, rating: r.rating as number,
    }));
    const attempted = new Set(
      (db.prepare(`SELECT puzzle_id FROM puzzle_attempts ORDER BY created_at DESC LIMIT 300`).all() as Row[])
        .map((r) => r.puzzle_id as string),
    );
    const pick = pickNextPuzzle(mastery, puzzles, attempted, req.query.conceptId as ConceptId | undefined);
    if (!pick) throw Object.assign(new Error('No puzzles available'), { statusCode: 404 });
    return puzzleResponse(getPuzzle(db, pick.id));
  });

  app.get<{ Params: { id: string } }>('/api/puzzles/:id', async (req) => puzzleResponse(getPuzzle(db, req.params.id)));

  app.post<{ Params: { id: string }; Body: { moves?: string[]; movesPlayed?: string[]; solved?: boolean; hintsUsed?: number; timeMs?: number } }>(
    '/api/puzzles/:id/attempt',
    async (req) => {
      const p = getPuzzle(db, req.params.id);
      const moves = req.body.movesPlayed ?? req.body.moves ?? [];
      const learnerMoves = p.solutionUci.filter((_, i) => i % 2 === 0);
      const matchesFull = moves.length === p.solutionUci.length && moves.every((m, i) => m === p.solutionUci[i]);
      const matchesLearner = moves.length === learnerMoves.length && moves.every((m, i) => m === learnerMoves[i]);
      const legal = moves.length > 0 && isLegalSequence(p.fen, moves);
      const correct = legal && (matchesFull || matchesLearner);
      db.prepare(`INSERT INTO puzzle_attempts (id, puzzle_id, solved, hints_used, time_ms, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(randomUUID(), p.id, correct ? 1 : 0, req.body.hintsUsed ?? 0, req.body.timeMs ?? 0, nowIso());
      return { correct, solutionUci: p.solutionUci };
    },
  );

/** Shared PGN import used by both manual upload and Chess.com sync. */
function importPgnGame(db: DatabaseSync, pgnRaw: string, source: string) {
  const pgn = (pgnRaw ?? '').trim();
  if (!pgn) throw Object.assign(new Error('Empty PGN'), { statusCode: 400 });
  let parsed: { sans: string[]; ucis: string[]; fensBefore: string[]; result: string };
  try {
    parsed = parsePgn(pgn);
  } catch (e) {
    throw Object.assign(new Error(`Invalid PGN: ${(e as Error).message}`), { statusCode: 400 });
  }
  const chess = new Chess();
  chess.loadPgn(pgn);
  const headers = chess.header();
  const id = randomUUID();
  db.prepare(`INSERT INTO games (id, source, white, black, result, pgn, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, source, headers['White'] ?? 'White', headers['Black'] ?? 'Black', parsed.result, pgn, nowIso());
  const ins = db.prepare(
    `INSERT INTO game_moves (game_id, ply, san, uci, fen_before, classification, concept_links) VALUES (?, ?, ?, ?, ?, 'unanalyzed', '[]')`,
  );
  const txBody = () => {
    parsed.sans.forEach((san, i) => ins.run(id, i + 1, san, parsed.ucis[i], parsed.fensBefore[i]));
  };
  transaction(db, txBody);
  const moves: GameMove[] = parsed.sans.map((san, i) => ({
    ply: i + 1, san, uci: parsed.ucis[i], fenBefore: parsed.fensBefore[i],
    evalCp: null, cpLoss: null, classification: 'unanalyzed' as const, conceptLinks: [],
  }));
  return {
    game: {
      id, source, white: headers['White'] ?? 'White', black: headers['Black'] ?? 'Black',
      result: parsed.result, importedAt: nowIso(), moveCount: parsed.sans.length, analyzed: false,
    },
    pgn, moves,
  };
}

  // ---- games ----
  app.post<{ Body: { pgn: string; source?: string } }>('/api/games/import', async (req) => {
    return importPgnGame(db, req.body.pgn ?? '', req.body.source ?? 'pgn-upload');
  });

  app.post<{ Body: { username: string; maxGames?: number } }>('/api/games/import-chesscom', async (req) => {
    const username = normalizeUsername(req.body.username ?? '');
    const maxGames = Math.min(Math.max(req.body.maxGames ?? 30, 1), 200);
    const fetched = await fetchChesscomGames(username, maxGames);
    // Dedup: skip games already imported (matched by their chess.com Link header).
    const knownLinks = new Set(
      (db.prepare(`SELECT pgn FROM games WHERE source='chesscom'`).all() as Row[])
        .map((r) => extractGameLink(r.pgn as string))
        .filter((l): l is string => !!l),
    );
    let imported = 0;
    let skipped = 0;
    const games: unknown[] = [];
    for (const g of fetched) {
      const link = extractGameLink(g.pgn) ?? g.url;
      if (link && knownLinks.has(link)) {
        skipped++;
        continue;
      }
      try {
        const res = importPgnGame(db, g.pgn, 'chesscom');
        imported++;
        games.push(res.game);
        if (link) knownLinks.add(link);
      } catch {
        skipped++; // unparseable PGN — skip rather than failing the whole sync
      }
    }
    return { username, fetched: fetched.length, imported, skipped, games };
  });

  app.get('/api/games', async () => {
    const rows = db.prepare(`SELECT id, source, white, black, result, imported_at, analyzed FROM games ORDER BY imported_at DESC`).all() as Row[];
    return rows.map((r) => ({
      id: r.id, source: r.source, white: r.white, black: r.black, result: r.result,
      importedAt: r.imported_at, moveCount: (db.prepare(`SELECT COUNT(*) AS n FROM game_moves WHERE game_id=?`).get(r.id as string) as Row).n,
      analyzed: (r.analyzed as number) === 1,
    }));
  });

  app.get<{ Params: { id: string } }>('/api/games/:id', async (req) => {
    const g = db.prepare(`SELECT * FROM games WHERE id=?`).get(req.params.id) as Row | undefined;
    if (!g) throw Object.assign(new Error('Game not found'), { statusCode: 404 });
    const moves = (db.prepare(`SELECT * FROM game_moves WHERE game_id=? ORDER BY ply`).all(req.params.id) as Row[])
      .map((r) => ({
        ply: r.ply, san: r.san, uci: r.uci, fenBefore: r.fen_before,
        evalCp: r.eval_cp, cpLoss: r.cp_loss, classification: r.classification, conceptLinks: j(r.concept_links),
      }));
    return {
      game: {
        id: g.id, source: g.source, white: g.white, black: g.black, result: g.result,
        importedAt: g.imported_at, moveCount: moves.length, analyzed: (g.analyzed as number) === 1,
      },
      pgn: g.pgn, moves,
    };
  });

  app.post<{ Params: { id: string }; Body: { evals?: { ply: number; evalCp: number; bestUci?: string; depth?: number }[] } }>(
    '/api/games/:id/analyze',
    async (req) => {
      const gameId = req.params.id;
      const g = db.prepare(`SELECT id FROM games WHERE id=?`).get(gameId) as Row | undefined;
      if (!g) throw Object.assign(new Error('Game not found'), { statusCode: 404 });
      const evals = new Map((req.body.evals ?? []).map((e) => [e.ply, e]));
      const moves = db.prepare(`SELECT * FROM game_moves WHERE game_id=? ORDER BY ply`).all(gameId) as Row[];
      const upd = db.prepare(
        `UPDATE game_moves SET eval_cp=?, cp_loss=?, classification=?, concept_links=? WHERE game_id=? AND ply=?`,
      );
      const txBody = () => {
        for (const m of moves) {
          const ply = m.ply as number;
          const ev = evals.get(ply);
          if (!ev) continue;
          const next = evals.get(ply + 1);
          // evalCp is side-to-move perspective; cpLoss from the mover's view.
          const afterMover = next ? -next.evalCp : -ev.evalCp;
          const cpLoss = Math.max(0, Math.round(ev.evalCp - afterMover));
          const classification = classify(cpLoss, ply, ev.bestUci, m.uci as string);
          const conceptLinks = linkConcepts(m.fen_before as string, m.uci as string, classification);
          upd.run(ev.evalCp, cpLoss, classification, jj(conceptLinks), gameId, ply);
        }
      };
      transaction(db, txBody);
      db.prepare(`UPDATE games SET analyzed=1 WHERE id=?`).run(gameId);
      const out = (db.prepare(`SELECT * FROM game_moves WHERE game_id=? ORDER BY ply`).all(gameId) as Row[])
        .map((r) => ({
          ply: r.ply, san: r.san, uci: r.uci, fenBefore: r.fen_before,
          evalCp: r.eval_cp, cpLoss: r.cp_loss, classification: r.classification, conceptLinks: j(r.concept_links),
        }));
      return { moves: out };
    },
  );

  // ---- tutor ----
  app.post<{ Body: { messages?: { role: 'user' | 'assistant'; content: string }[]; fen?: string; engine?: { bestUci: string; evalCp: number; depth: number } | null } }>(
    '/api/tutor/chat',
    async (req) => {
      const body = req.body ?? {};
      const fen = body.fen ?? new Chess().fen();
      try { new Chess(fen); } catch { throw Object.assign(new Error('Invalid position FEN'), { statusCode: 400 }); }
      const history: ChatMsg[] = (body.messages ?? []).slice(-8);
      const mastery = getMastery(db);
      const weak = [...mastery].sort((a, b) => a.mastery - b.mastery).slice(0, 3).map((m) => m.conceptId);
      const recentMistakes = (db.prepare(
        `SELECT concept_links FROM game_moves WHERE concept_links != '[]' ORDER BY game_id DESC LIMIT 200`,
      ).all() as Row[])
        .flatMap((r) => j<{ conceptId: ConceptId; confidence: number }[]>(r.concept_links))
        .filter((l) => l.confidence >= 0.5)
        .map((l) => l.conceptId);
      const mistakeSummary = [...new Set(recentMistakes)].slice(0, 3);

      // Persist compact history (user + assistant turns).
      const persist = db.prepare(`INSERT INTO tutor_messages (id, role, content, fen, created_at) VALUES (?, ?, ?, ?, ?)`);
      const lastUser = history.filter((m) => m.role === 'user').slice(-1)[0];
      if (lastUser) {
        persist.run(randomUUID(), 'user', lastUser.content.slice(0, 4000), fen, nowIso());
        db.prepare(`DELETE FROM tutor_messages WHERE id NOT IN (SELECT id FROM tutor_messages ORDER BY created_at DESC LIMIT 50)`).run();
      }

      const cfg = loadAiConfig();
      let reply: string;
      let aiConfigured = false;
      if (cfg) {
        try {
          const system = tutorSystemPrompt({ fen, weakConcepts: weak, recentMistakes: mistakeSummary, engine: body.engine ?? null });
          reply = await chatCompletion(cfg, system, history);
          aiConfigured = true;
        } catch (e) {
          reply = `The AI tutor hit an error (${(e as Error).message}). Your position is still analyzable with the on-board engine — ask me to explain the engine's suggestion and I'll walk through it.`;
        }
      } else {
        reply = coachLiteReply(fen, body.engine ?? null, weak);
      }
      const candidates = extractUciMoves(reply);
      const valid = validatedMoves(fen, candidates);
      persist.run(randomUUID(), 'assistant', reply.slice(0, 4000), fen, nowIso());
      const response: TutorChatResponse = { reply, aiConfigured, validatedMoves: valid };
      return response;
    },
  );

  // ---- progress ----
  app.get('/api/progress', async () => {
    const mastery = getMastery(db);
    const withNames = mastery.map((m) => ({
      ...m,
      name: CONCEPTS.find((c) => c.id === m.conceptId)?.name ?? m.conceptId,
    }));
    const sorted = [...withNames].sort((a, b) => a.mastery - b.mastery);
    const weakest = sorted.slice(0, 3).map((m) => m.conceptId);
    const strongest = [...withNames].sort((a, b) => b.mastery - a.mastery).slice(0, 3).map((m) => m.conceptId);
    const recentSessions = (db.prepare(`SELECT id, minutes, started_at, status, plan, completed_steps FROM sessions ORDER BY started_at DESC LIMIT 8`).all() as Row[])
      .map((r) => ({
        id: r.id as string, minutes: r.minutes as number, startedAt: r.started_at as string,
        status: r.status as string, stepsDone: (j<number[]>(r.completed_steps)).length, stepsTotal: (j<unknown[]>(r.plan)).length,
      }));
    const attRows = db.prepare(
      `SELECT outcome, created_at FROM exercise_attempts
       UNION ALL
       SELECT CASE WHEN solved=1 THEN 'independent' ELSE 'shown' END AS outcome, created_at FROM puzzle_attempts
       ORDER BY created_at DESC LIMIT 50`,
    ).all() as Row[];
    const accuracyIndependent = attRows.length
      ? attRows.filter((r) => r.outcome === 'independent').length / attRows.length : 0;
    const reviewsDue = (db.prepare(`SELECT COUNT(*) AS n FROM mastery WHERE next_review_at IS NOT NULL AND next_review_at <= ?`).get(nowIso()) as Row).n as number;
    const linkRows = (db.prepare(`SELECT concept_links FROM game_moves WHERE concept_links != '[]'`).all() as Row[]);
    const mistakeCounts = new Map<ConceptId, number>();
    for (const r of linkRows) {
      for (const l of j<{ conceptId: ConceptId; confidence: number }[]>(r.concept_links)) {
        if (l.confidence >= 0.5) mistakeCounts.set(l.conceptId, (mistakeCounts.get(l.conceptId) ?? 0) + 1);
      }
    }
    const recurringMistakes = [...mistakeCounts.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([conceptId, count]) => ({ conceptId, count }));
    snapshotToday(db);
    const masteryTrend = (db.prepare(`SELECT day AS date, avg_mastery AS avgMastery FROM mastery_snapshots ORDER BY day DESC LIMIT 30`).all() as Row[])
      .reverse().map((r) => ({ date: r.date as string, avgMastery: r.avgMastery as number }));
    const nextPriorities = weakest.slice(0, 3).map((conceptId) => {
      const m = mastery.find((x) => x.conceptId === conceptId);
      const reason = (m?.attempts ?? 0) === 0
        ? 'Not yet practiced — start with the introductory lesson.'
        : `Lowest mastery (${Math.round((m?.mastery ?? 0) * 100)}%). Targeted practice scheduled.`;
      return { conceptId, reason };
    });
    const data: DashboardData = {
      concepts: withNames, strongest, weakest, recentSessions, accuracyIndependent,
      reviewsDue, recurringMistakes, masteryTrend, nextPriorities,
    };
    return data;
  });

  // ---- export ----
  app.get('/api/export', async () => {
    const diag = { version: API_VERSION, exportedAt: nowIso() };
    return {
      diag,
      profile: await (async () => (db.prepare(`SELECT * FROM profile WHERE id=1`).get() as Row))(),
      mastery: getMastery(db),
      counts: {
        exerciseAttempts: (db.prepare(`SELECT COUNT(*) AS n FROM exercise_attempts`).get() as Row).n,
        puzzleAttempts: (db.prepare(`SELECT COUNT(*) AS n FROM puzzle_attempts`).get() as Row).n,
        games: (db.prepare(`SELECT COUNT(*) AS n FROM games`).get() as Row).n,
        sessions: (db.prepare(`SELECT COUNT(*) AS n FROM sessions`).get() as Row).n,
      },
    };
  });
}

// ---------------------------------------------------------------- analysis

function classify(cpLoss: number, ply: number, bestUci: string | undefined, playedUci: string): GameMove['classification'] {
  if (ply <= 8 && cpLoss < 50) return 'book';
  if (cpLoss < 30) return bestUci && bestUci === playedUci ? 'best' : 'good';
  if (cpLoss < 80) return 'good';
  if (cpLoss < 150) return 'inaccuracy';
  if (cpLoss < 300) return 'mistake';
  return 'blunder';
}

/**
 * Heuristic concept links with confidence. Sparse by design: no link means
 * "ambiguous", never force an attribution.
 */
function linkConcepts(fenBefore: string, playedUci: string, classification: string): { conceptId: ConceptId; confidence: number }[] {
  if (classification !== 'mistake' && classification !== 'blunder') return [];
  const links: { conceptId: ConceptId; confidence: number }[] = [];
  try {
    const chess = new Chess(fenBefore);
    // Missed mate in 1?
    const matingMove = chess.moves({ verbose: true }).find((m) => {
      const c = new Chess(fenBefore);
      c.move(m.san);
      return c.isCheckmate();
    });
    if (matingMove) {
      links.push({ conceptId: 'tactics', confidence: 0.65 });
      return links;
    }
    // Play the move; does the opponent now have a capture of a valuable piece?
    const after = new Chess(fenBefore);
    after.move({ from: playedUci.slice(0, 2), to: playedUci.slice(2, 4), promotion: playedUci[4] });
    const pieceValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    for (const m of after.moves({ verbose: true })) {
      if (m.captured && (pieceValues[m.captured] ?? 0) >= 3) {
        links.push({ conceptId: 'hanging-pieces', confidence: 0.55 });
        break;
      }
    }
    // King still central after move 12?
    if (links.length === 0) {
      const before = new Chess(fenBefore);
      const fullmove = parseInt(fenBefore.split(' ')[5] ?? '1', 10);
      const turn = before.turn();
      const kingSq = before.board().flat().find((s) => s && s.type === 'k' && s.color === turn)?.square ?? '';
      const central = turn === 'w' ? /^[de][12]$/.test(kingSq) : /^[de][78]$/.test(kingSq);
      if (fullmove > 12 && central) {
        links.push({ conceptId: 'king-safety', confidence: 0.5 });
      }
    }
  } catch {
    // heuristics are best-effort; never break analysis
  }
  return links;
}

/** Deterministic no-AI coach reply built from engine data + weak concepts. */
function coachLiteReply(
  fen: string,
  engine: { bestUci: string; evalCp: number; depth: number } | null,
  weak: string[],
): string {
  const parts: string[] = [];
  if (engine) {
    const side = new Chess(fen).turn() === 'w' ? 'White' : 'Black';
    const pawns = (engine.evalCp / 100).toFixed(1);
    parts.push(
      `Engine read (depth ${engine.depth}): ${side} to move, evaluation ${engine.evalCp >= 0 ? '+' : ''}${pawns}. Suggested: ${engine.bestUci}.`,
    );
    parts.push('Ask me "why is that the best move?" and I will walk through the ideas — or set an AI provider key to unlock full conversational coaching.');
  } else {
    parts.push(
      'The on-board engine has not analyzed this position yet — tap "Analyze" to get an engine read first, then ask me about it.',
    );
  }
  if (weak.length) {
    parts.push(`Your current focus areas: ${weak.join(', ')}.`);
  }
  parts.push('Note: conversational AI coaching is not configured (no AI_API_KEY). Everything else — lessons, puzzles, analysis — works fully offline.');
  return parts.join('\n\n');
}

function snapshotToday(db: DatabaseSync): void {
  const mastery = getMastery(db);
  const avg = mastery.reduce((s, m) => s + m.mastery, 0) / mastery.length;
  const day = nowIso().slice(0, 10);
  db.prepare(`INSERT INTO mastery_snapshots (day, avg_mastery) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET avg_mastery=?`)
    .run(day, Math.round(avg * 1000) / 1000, Math.round(avg * 1000) / 1000);
}

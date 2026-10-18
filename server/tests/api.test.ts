import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCHOLARS_MATE = `[White "Student"]
[Black "Coach"]
[Result "1-0"]

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0`;

let app: ReturnType<typeof Fastify>;
let db: import('node:sqlite').DatabaseSync;

beforeEach(async () => {
  vi.resetModules();
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'ct-test-'));
  const { getDb } = await import('../src/db/index.js');
  const { seed } = await import('../src/db/seed.js');
  const { registerRoutes } = await import('../src/routes.js');
  db = getDb();
  seed(db);
  app = Fastify();
  app.setErrorHandler((err: unknown, _req: unknown, reply: { code: (n: number) => { send: (o: unknown) => void } }) => {
    const e = err as { statusCode?: number; message?: string };
    reply.code(e.statusCode ?? 500).send({ error: e.message });
  });
  registerRoutes(app, db);
});

// vitest hoisting: import vi at top via dynamic import hack avoided by using globalThis
import { vi } from 'vitest';

describe('health & diagnostics', () => {
  it('reports health and diagnostics', async () => {
    const h = await app.inject({ method: 'GET', url: '/api/health' });
    expect(h.statusCode).toBe(200);
    expect(h.json().status).toBe('ok');
    const d = await app.inject({ method: 'GET', url: '/api/diagnostics' });
    expect(d.json().aiConfigured).toBe(false);
    expect(d.json().counts.lessons).toBe(15);
    expect(d.json().counts.exercises).toBe(60);
    expect(d.json().counts.puzzles).toBe(48);
  });
});

describe('assessment flow', () => {
  it('runs start -> answer -> finish and seeds mastery', async () => {
    const start = await app.inject({ method: 'POST', url: '/api/assessment/start' });
    expect(start.statusCode).toBe(200);
    const { assessmentId, items, exercises } = start.json();
    expect(items.length).toBe(15);
    expect(exercises.length).toBe(15);
    // Answer everything independently correct using the known solutions.
    for (const ex of exercises) {
      const ans = await app.inject({
        method: 'POST', url: '/api/assessment/answer',
        payload: { assessmentId, exerciseId: ex.id, playedUci: ex.solutionUci[0], hintsUsed: 0, timeMs: 5000 },
      });
      expect(ans.json().correct).toBe(true);
    }
    const fin = await app.inject({ method: 'POST', url: '/api/assessment/finish', payload: { assessmentId } });
    expect(fin.statusCode).toBe(200);
    const result = fin.json();
    expect(result.profile.length).toBe(15);
    // All-correct => mastery rose above prior for tested concepts
    const tactics = result.profile.find((p: { conceptId: string }) => p.conceptId === 'tactics');
    expect(tactics.mastery).toBeGreaterThan(0.2);
    expect(Array.isArray(result.uncertain)).toBe(true);
  });
});

describe('exercise attempts drive mastery', () => {
  it('independent success raises mastery, shown lowers it', async () => {
    const lessons = await app.inject({ method: 'GET', url: '/api/lessons?conceptId=tactics' });
    const lessonId = lessons.json()[0].id;
    const detail = await app.inject({ method: 'GET', url: `/api/lessons/${lessonId}` });
    const ex = detail.json().exercises[0];
    const before = (await app.inject({ method: 'GET', url: '/api/concepts' })).json()
      .find((c: { id: string }) => c.id === 'tactics').mastery.mastery;
    const r1 = await app.inject({
      method: 'POST', url: `/api/exercises/${ex.id}/attempt`,
      payload: { playedUci: ex.solutionUci[0], hintsUsed: 0, timeMs: 3000 },
    });
    expect(r1.json().correct).toBe(true);
    expect(r1.json().mastery.mastery).toBeGreaterThan(before);
    const r2 = await app.inject({
      method: 'POST', url: `/api/exercises/${ex.id}/attempt`,
      payload: { playedUci: 'a2a3', hintsUsed: 0, timeMs: 3000 },
    });
    expect(r2.json().correct).toBe(false);
    expect(r2.json().mastery.mastery).toBeLessThan(r1.json().mastery.mastery);
  });
});

describe('sessions', () => {
  it('starts, pauses, resumes, completes steps', async () => {
    const s = await app.inject({ method: 'POST', url: '/api/sessions/start', payload: { minutes: 20 } });
    expect(s.statusCode).toBe(200);
    const session = s.json();
    expect(session.plan.length).toBeGreaterThan(0);
    expect(session.plan.length).toBeLessThanOrEqual(10);
    await app.inject({ method: 'POST', url: `/api/sessions/${session.id}/pause` });
    const paused = await app.inject({ method: 'GET', url: `/api/sessions/${session.id}` });
    expect(paused.json().status).toBe('paused');
    await app.inject({ method: 'POST', url: `/api/sessions/${session.id}/resume` });
    await app.inject({ method: 'POST', url: `/api/sessions/${session.id}/complete-step`, payload: { stepIndex: 0 } });
    const after = await app.inject({ method: 'GET', url: `/api/sessions/${session.id}` });
    expect(after.json().completedStepIndexes).toEqual([0]);
  });
});

describe('puzzles', () => {
  it('serves next puzzle with hints and accepts a solution', async () => {
    const n = await app.inject({ method: 'GET', url: '/api/puzzles/next' });
    expect(n.statusCode).toBe(200);
    const pz = n.json();
    expect(pz.hints.length).toBe(3);
    expect(pz.explanation.length).toBeGreaterThan(0);
    const att = await app.inject({
      method: 'POST', url: `/api/puzzles/${pz.id}/attempt`,
      payload: { moves: pz.solutionUci.filter((_: string, i: number) => i % 2 === 0), hintsUsed: 0, timeMs: 8000 },
    });
    expect(att.json().correct).toBe(true);
  });
});

describe('games', () => {
  it('imports PGN and analyzes with engine evals', async () => {
    const imp = await app.inject({ method: 'POST', url: '/api/games/import', payload: { pgn: SCHOLARS_MATE } });
    expect(imp.statusCode).toBe(200);
    const gameId = imp.json().game.id;
    expect(imp.json().moves.length).toBe(7);
    // Fake engine evals: all good except black's 3...Nf6 blunder
    const evals = [
      { ply: 1, evalCp: 20 }, { ply: 2, evalCp: 25 }, { ply: 3, evalCp: 30 },
      { ply: 4, evalCp: 35 }, { ply: 5, evalCp: 60 }, { ply: 6, evalCp: -800 },
      { ply: 7, evalCp: 10000 },
    ];
    const an = await app.inject({ method: 'POST', url: `/api/games/${gameId}/analyze`, payload: { evals } });
    expect(an.statusCode).toBe(200);
    const moves = an.json().moves;
    const blunder = moves.find((m: { ply: number }) => m.ply === 6);
    expect(['mistake', 'blunder']).toContain(blunder.classification);
    expect(blunder.cpLoss).toBeGreaterThan(150);
    // Missed mate in 1 for white exists at some point? 4.Qxf7# was played; check concept links are sparse/honest
    expect(Array.isArray(blunder.conceptLinks)).toBe(true);
  });

  it('rejects invalid PGN', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/games/import', payload: { pgn: 'nonsense' } });
    expect(r.statusCode).toBe(400);
  });
});

describe('chess.com sync', () => {
  const PGN1 = `[White "hggv135v"]\n[Black "opp1"]\n[Result "1-0"]\n[Link "https://www.chess.com/game/live/111"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0`;
  const PGN2 = `[White "opp2"]\n[Black "hggv135v"]\n[Result "0-1"]\n[Link "https://www.chess.com/game/live/222"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 0-1`;

  function mockFetch() {
    return vi.stubGlobal('fetch', async (url: string) => {
      const u = String(url);
      if (u.endsWith('/pub/player/testuser')) {
        return { ok: true, status: 200, json: async () => ({ username: 'testuser' }) };
      }
      if (u.endsWith('/pub/player/nonexistentuser9z')) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      if (u.endsWith('/games/archives')) {
        return { ok: true, status: 200, json: async () => ({ archives: ['https://api.chess.com/pub/player/testuser/games/2026/10'] }) };
      }
      if (u.endsWith('/games/2026/10')) {
        return {
          ok: true, status: 200,
          json: async () => ({ games: [{ pgn: PGN1, url: 'https://www.chess.com/game/live/111' }, { pgn: PGN2, url: 'https://www.chess.com/game/live/222' }] }),
        };
      }
      throw new Error('unexpected fetch: ' + u);
    });
  }

  it('imports recent games and dedups on re-sync', async () => {
    mockFetch();
    try {
      const r1 = await app.inject({ method: 'POST', url: '/api/games/import-chesscom', payload: { username: 'TestUser', maxGames: 10 } });
      expect(r1.statusCode).toBe(200);
      const b1 = r1.json();
      expect(b1.username).toBe('testuser');
      expect(b1.fetched).toBe(2);
      expect(b1.imported).toBe(2);
      expect(b1.skipped).toBe(0);
      expect(b1.games.length).toBe(2);
      // Re-sync: both already imported -> skipped
      const r2 = await app.inject({ method: 'POST', url: '/api/games/import-chesscom', payload: { username: 'testuser', maxGames: 10 } });
      const b2 = r2.json();
      expect(b2.imported).toBe(0);
      expect(b2.skipped).toBe(2);
      // Games list shows chesscom source
      const list = await app.inject({ method: 'GET', url: '/api/games' });
      expect(list.json().filter((g: { source: string }) => g.source === 'chesscom').length).toBe(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects unknown users and bad usernames', async () => {
    mockFetch();
    try {
      const r1 = await app.inject({ method: 'POST', url: '/api/games/import-chesscom', payload: { username: 'nonexistentuser9z' } });
      expect(r1.statusCode).toBe(404);
      const r2 = await app.inject({ method: 'POST', url: '/api/games/import-chesscom', payload: { username: 'x!' } });
      expect(r2.statusCode).toBe(400);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('tutor without AI key', () => {
  it('returns coach-lite reply and validates moves', async () => {
    const r = await app.inject({
      method: 'POST', url: '/api/tutor/chat',
      payload: {
        messages: [{ role: 'user', content: 'What should I play here? I was thinking e2e4.' }],
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        engine: { bestUci: 'e2e4', evalCp: 25, depth: 12 },
      },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.aiConfigured).toBe(false);
    expect(body.validatedMoves).toContain('e2e4');
    expect(body.reply.length).toBeGreaterThan(50);
  });
});

describe('progress & export', () => {
  it('returns dashboard data and export', async () => {
    const p = await app.inject({ method: 'GET', url: '/api/progress' });
    expect(p.statusCode).toBe(200);
    const d = p.json();
    expect(d.concepts.length).toBe(15);
    expect(d.weakest.length).toBe(3);
    expect(d.nextPriorities.length).toBe(3);
    const e = await app.inject({ method: 'GET', url: '/api/export' });
    expect(e.json().diag.version).toBeTruthy();
  });
});

describe('server-verified exercise outcomes', () => {
  it('does not reward incorrect moves even if the client claims independent success', async () => {
    const lessons = await app.inject({ method: 'GET', url: '/api/lessons?conceptId=tactics' });
    const id = lessons.json()[0].id;
    const detail = await app.inject({ method: 'GET', url: `/api/lessons/${id}` });
    const ex = detail.json().exercises.find((e: { kind: string }) => e.kind !== 'yes-no') ?? detail.json().exercises[0];
    const r = await app.inject({ method: 'POST', url: `/api/exercises/${ex.id}/attempt`,
      payload: { playedUci: 'not-a-move', correct: true, outcome: 'independent', hintsUsed: 0 } });
    expect(r.statusCode).toBe(200);
    expect(r.json().correct).toBe(false);
    expect(r.json().outcome).toBe('shown');
    expect(r.json().mastery.mastery).toBeLessThan(0.2);
  });
  it('never rewards a revealed solution, even when it matches the correct move', async () => {
    const lessons = await app.inject({ method: 'GET', url: '/api/lessons?conceptId=tactics' });
    const detail = await app.inject({ method: 'GET', url: `/api/lessons/${lessons.json()[0].id}` });
    const ex = detail.json().exercises[0];
    const r = await app.inject({ method: 'POST', url: `/api/exercises/${ex.id}/attempt`,
      payload: { playedUci: ex.solutionUci[0], outcome: 'shown', correct: true } });
    expect(r.json().correct).toBe(false);
    expect(r.json().outcome).toBe('shown');
  });
  it('does not seed assessment mastery from a wrong answer claimed as success', async () => {
    const begin = await app.inject({ method: 'POST', url: '/api/assessment/start' });
    const { assessmentId, exercises } = begin.json();
    const ex = exercises[0];
    const a = await app.inject({ method: 'POST', url: '/api/assessment/answer',
      payload: { assessmentId, exerciseId: ex.id, playedUci: 'not-a-move', outcome: 'independent', correct: true } });
    expect(a.json().correct).toBe(false);
    await app.inject({ method: 'POST', url: '/api/assessment/finish', payload: { assessmentId } });
    const concepts = (await app.inject({ method: 'GET', url: '/api/concepts' })).json();
    expect(concepts.find((c: { id: string }) => c.id === ex.conceptId).mastery.mastery).toBeLessThan(0.2);
  });
});

describe('incomplete and terminal game analysis', () => {
  it('never invents an evaluation of the last move when no after-position read exists', async () => {
    const imported = await app.inject({ method: 'POST', url: '/api/games/import', payload: { pgn: SCHOLARS_MATE } });
    const gameId = imported.json().game.id;
    const moves = imported.json().moves;
    const evals = moves.map((m: { ply: number }) => ({ ply: m.ply, evalCp: 0, bestUci: '' }));
    const partial = await app.inject({ method: 'POST', url: `/api/games/${gameId}/analyze`, payload: { evals } });
    expect(partial.json().moves.at(-1).classification).toBe('unanalyzed');
    const detail1 = await app.inject({ method: 'GET', url: `/api/games/${gameId}` });
    expect(detail1.json().game.analyzed).toBe(false);
    // Last position is checkmate for the side to move, evaluated at -100000 cp.
    const finished = await app.inject({ method: 'POST', url: `/api/games/${gameId}/analyze`,
      payload: { evals: [...evals, { ply: moves.at(-1).ply + 1, evalCp: -100000, bestUci: '' }] } });
    expect(finished.json().moves.at(-1).classification).not.toBe('unanalyzed');
    const detail2 = await app.inject({ method: 'GET', url: `/api/games/${gameId}` });
    expect(detail2.json().game.analyzed).toBe(true);
  });
});

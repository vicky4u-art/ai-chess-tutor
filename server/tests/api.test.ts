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

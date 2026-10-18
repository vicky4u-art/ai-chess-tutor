import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seed } from '../src/db/seed.js';
import { EXERCISES, LESSONS } from '../src/data/curriculum.js';
import { SEED_PUZZLES } from '../src/data/seed-puzzles.js';

const byId = (id: string) => {
  const ex = EXERCISES.find((e) => e.id === id);
  if (!ex) throw new Error('Missing ' + id);
  return ex;
};
function move(g: Chess, uci: string) {
  return g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
}

describe('lesson answer accuracy regressions', () => {
  it('rejects invented checkmates and preserves genuine ones', () => {
    for (const id of ['ex-rules-1', 'ex-rules-2', 'ex-rules-3', 'ex-cal-1', 'ex-cal-3', 'ex-re-2']) {
      const e = byId(id);
      const board = new Chess(e.fen);
      move(board, e.solutionUci[0]);
      expect(board.isCheckmate(), id).toBe(true);
    }
  });
  it('initial positions are reachable: the nonmoving king is never in check', () => {
    for (const item of [...EXERCISES, ...SEED_PUZZLES]) {
      const board = new Chess(item.fen);
      const other = board.turn() === 'w' ? 'b' : 'w';
      const king = board.board().flat().find((p) => p?.type === 'k' && p.color === other);
      expect(king, item.id).toBeDefined();
      expect(board.isAttacked(king!.square, board.turn()), item.id).toBe(false);
    }
  });
  it('early queen attack really threatens Scholar mate', () => {
    const e = byId('ex-ks-4'), g = new Chess(e.fen);
    move(g, 'b8c6');
    move(g, 'h5f7');
    expect(g.isCheckmate()).toBe(true);
    expect(e.solutionUci).toEqual(['no']);
  });
  it('the d4/c4 pawn advance to e4 would hang the pawn', () => {
    const e = byId('ex-cen-2'), g = new Chess(e.fen);
    move(g, 'e2e4');
    expect(g.moves({ verbose: true }).some((m) => m.from === 'f6' && m.to === 'e4')).toBe(true);
    expect(e.solutionUci[0]).not.toBe('e2e4');
  });
  it('a Ruy Lopez bishop does not absolutely pin c6 while d7 blocks the diagonal', () => {
    const e = byId('ex-tac-1'), g = new Chess(e.fen);
    move(g, 'f1b5');
    expect(g.moves({ verbose: true }).some((m) => m.from === 'c6')).toBe(true);
  });
  it('the rook on a8 can capture a rook played to a4', () => {
    const e = byId('ex-dec-2'), g = new Chess(e.fen);
    move(g, 'a1a4');
    expect(g.moves({ verbose: true }).some((m) => m.from === 'a8' && m.to === 'a4')).toBe(true);
    expect(e.solutionUci[0]).toBe('a1c1');
  });
  it('rook-endgame teaching is consistent with the playable puzzle', () => {
    const g = new Chess(byId('ex-re-3').fen);
    move(g, byId('ex-re-3').solutionUci[0]);
    expect(g.isCheck()).toBe(true);
    expect(LESSONS.find((l) => l.id === 'lesson-rook-endgame')?.title).toContain('Active');
  });
});

describe('authored content upgrades without destroying progress', () => {
  it('refreshes existing lesson and exercise content while preserving mastery and attempts', () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec(readFileSync(join(process.cwd(), 'src/db/schema.sql'), 'utf8'));
      seed(db);
      db.prepare("UPDATE exercises SET prompt='STALLED OLD EXERCISE' WHERE id='ex-cen-2'").run();
      db.prepare("UPDATE lessons SET title='STALLED OLD LESSON' WHERE id='lesson-center'").run();
      db.prepare("UPDATE puzzles SET fen='OLD FEN' WHERE id='seed-038'").run();
      db.prepare("UPDATE mastery SET mastery=0.75, attempts=11 WHERE concept_id='center'").run();
      seed(db);
      const e = db.prepare("SELECT prompt FROM exercises WHERE id='ex-cen-2'").get() as { prompt: string };
      expect(e.prompt).toBe(byId('ex-cen-2').prompt);
      const l = db.prepare("SELECT title FROM lessons WHERE id='lesson-center'").get() as { title: string };
      expect(l.title).toBe(LESSONS.find((v) => v.id === 'lesson-center')?.title);
      const p = db.prepare("SELECT fen FROM puzzles WHERE id='seed-038'").get() as { fen: string };
      expect(p.fen).toBe(SEED_PUZZLES.find((v) => v.id === 'seed-038')?.fen);
      const m = db.prepare("SELECT mastery, attempts FROM mastery WHERE concept_id='center'").get() as { mastery: number; attempts: number };
      expect(m).toEqual({ mastery: 0.75, attempts: 11 });
    } finally {
      db.close();
    }
  });
});

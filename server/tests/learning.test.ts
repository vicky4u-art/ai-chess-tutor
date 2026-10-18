import { describe, it, expect } from 'vitest';
import {
  updateMastery, estimatedStrength, difficultyBand, assessmentSeed,
  planSession, pickNextPuzzle,
} from '../src/learning.js';
import { emptyMastery, CONCEPTS } from '@chesstutor/shared';

describe('updateMastery', () => {
  it('moves toward the outcome value with the right learning rate', () => {
    const m = emptyMastery('tactics');
    const { record } = updateMastery(m, 0, 'independent');
    // 0.2 + 0.12 * (1.0 - 0.2) = 0.296
    expect(record.mastery).toBeCloseTo(0.296, 3);
    expect(record.attempts).toBe(1);
    expect(record.independentSuccesses).toBe(1);
  });

  it('pulls down on shown solutions', () => {
    const m = { ...emptyMastery('tactics'), mastery: 0.8 };
    const { record } = updateMastery(m, 3, 'shown');
    // 0.8 + 0.10 * (0 - 0.8) = 0.72
    expect(record.mastery).toBeCloseTo(0.72, 3);
    expect(record.independentSuccesses).toBe(0);
  });

  it('hinted moves halfway', () => {
    const m = emptyMastery('tactics');
    const { record } = updateMastery(m, 0, 'hinted');
    // 0.2 + 0.06 * (0.6 - 0.2) = 0.224
    expect(record.mastery).toBeCloseTo(0.224, 3);
  });

  it('clamps to [0.02, 0.98] and schedules spaced review', () => {
    const m = { ...emptyMastery('tactics'), mastery: 0.97 };
    const before = new Date('2026-01-01T00:00:00Z');
    const { record, streak } = updateMastery(m, 5, 'independent', before);
    expect(record.mastery).toBeLessThanOrEqual(0.98);
    expect(streak).toBe(6);
    // interval = 2^6 = 64 -> clamped to 60 days
    expect(record.nextReviewAt).toBe(new Date(before.getTime() + 60 * 86400_000).toISOString());
  });

  it('resets streak on shown', () => {
    const m = emptyMastery('tactics');
    const { streak, record } = updateMastery(m, 4, 'shown', new Date('2026-01-01T00:00:00Z'));
    expect(streak).toBe(0);
    // interval = 2^0 = 1 day
    expect(record.nextReviewAt).toBe(new Date(new Date('2026-01-01T00:00:00Z').getTime() + 86400_000).toISOString());
  });
});

describe('difficulty band', () => {
  it('maps mastery to a ±150 pseudo-rating band', () => {
    expect(estimatedStrength(0.2)).toBe(720);
    expect(estimatedStrength(1)).toBe(2000);
    const band = difficultyBand(0.5);
    expect(band).toEqual({ min: 1050, max: 1350 });
  });
  it('never goes negative', () => {
    expect(difficultyBand(0.02).min).toBeGreaterThanOrEqual(0);
  });
});

describe('assessmentSeed', () => {
  it('blends outcome with prior', () => {
    expect(assessmentSeed('independent')).toBeCloseTo(0.84, 2);
    expect(assessmentSeed('shown')).toBeCloseTo(0.04, 2);
  });
});

describe('planSession', () => {
  const fullMastery = CONCEPTS.map((c) => ({ ...emptyMastery(c.id), mastery: 0.3 }));
  const lessons = [
    { id: 'l1', conceptId: 'tactics' as never, level: 1 },
    { id: 'l2', conceptId: 'rules-checkmates' as never, level: 1 },
  ];
  const exercises = [
    { id: 'e1', conceptId: 'tactics' as never, difficulty: 104 },
    { id: 'e2', conceptId: 'rules-checkmates' as never, difficulty: 85 },
  ];
  const puzzles = [{ id: 'p1', rating: 1040 }];

  it('produces a bounded plan with reviews first', () => {
    const due = fullMastery.map((m) =>
      m.conceptId === 'tactics' ? { ...m, mastery: 0.4, nextReviewAt: '2020-01-01T00:00:00Z' } : m,
    );
    const plan = planSession(due, 20, lessons, exercises, puzzles, new Date('2026-01-01T00:00:00Z'));
    expect(plan.length).toBeLessThanOrEqual(10);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan[0].kind).toBe('review');
  });

  it('skips mastered concepts', () => {
    const strong = fullMastery.map((m) =>
      m.conceptId === 'tactics' ? { ...m, mastery: 0.9, attempts: 10 } : m,
    );
    const plan = planSession(strong, 20, lessons, exercises, puzzles);
    expect(plan.every((s) => s.conceptId !== 'tactics')).toBe(true);
  });
});

describe('pickNextPuzzle', () => {
  it('picks in-band, prefers fresh, deterministic', () => {
    const mastery = [{ ...emptyMastery('tactics' as never), mastery: 0.5 }];
    const puzzles = [
      { id: 'p1', rating: 5000 },
      { id: 'p2', rating: 1200 },
      { id: 'p3', rating: 1250 },
    ];
    const pick = pickNextPuzzle(mastery, puzzles, new Set(['p2']));
    expect(pick?.id).toBe('p3');
  });
  it('returns null when empty', () => {
    expect(pickNextPuzzle([], [], new Set())).toBeNull();
  });
});

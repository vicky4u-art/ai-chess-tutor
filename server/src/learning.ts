/**
 * Deterministic adaptive learning engine.
 *
 * The engine owns ALL mastery/progression math. The language model never
 * sets mastery scores. Every function here is pure and unit-tested.
 *
 * Model (documented in LEARNING_ENGINE.md):
 * - mastery m in [0.02, 0.98], prior 0.2
 * - outcome values: independent=1.0, hinted=0.6, shown=0.0
 * - update: m <- m + k*(outcome - m), k = 0.12 / 0.06 / 0.10
 * - difficulty target: estimatedStrength = 400 + m*1600, pick items within ±150
 * - spaced review: interval_days = clamp(2^streak, 1, 60); streak resets on 'shown'
 */
import {
  AttemptOutcome,
  CONCEPTS,
  ConceptId,
  MasteryRecord,
  SessionStep,
  emptyMastery,
} from '@chesstutor/shared';

export const OUTCOME_VALUE: Record<AttemptOutcome, number> = {
  independent: 1.0,
  hinted: 0.6,
  shown: 0.0,
};

export const LEARNING_RATE: Record<AttemptOutcome, number> = {
  independent: 0.12,
  hinted: 0.06,
  shown: 0.1,
};

export const MASTERY_MIN = 0.02;
export const MASTERY_MAX = 0.98;
export const MASTERY_PRIOR = 0.2;

export function updateMastery(
  prev: MasteryRecord,
  /** Consecutive non-'shown' outcomes before this attempt. */
  streak: number,
  outcome: AttemptOutcome,
  now: Date = new Date(),
): { record: MasteryRecord; streak: number } {
  const value = OUTCOME_VALUE[outcome];
  const k = LEARNING_RATE[outcome];
  const mastery = clamp(prev.mastery + k * (value - prev.mastery), MASTERY_MIN, MASTERY_MAX);
  const success = outcome !== 'shown';
  const nextStreak = success ? streak + 1 : 0;
  const intervalDays = clamp(Math.pow(2, nextStreak), 1, 60);
  const nextReviewAt = new Date(now.getTime() + intervalDays * 86400_000).toISOString();
  return {
    record: {
      conceptId: prev.conceptId,
      mastery: round3(mastery),
      attempts: prev.attempts + 1,
      independentSuccesses: prev.independentSuccesses + (outcome === 'independent' ? 1 : 0),
      lastSeenAt: now.toISOString(),
      nextReviewAt,
    },
    streak: nextStreak,
  };
}

/** Pseudo-rating used only for difficulty matching. NOT an Elo rating. */
export function estimatedStrength(mastery: number): number {
  return Math.round(400 + mastery * 1600);
}

export function difficultyBand(mastery: number, halfWidth = 150): { min: number; max: number } {
  const s = estimatedStrength(mastery);
  return { min: Math.max(0, s - halfWidth), max: s + halfWidth };
}

/** Seed mastery from one assessment item outcome. */
export function assessmentSeed(outcome: AttemptOutcome): number {
  return OUTCOME_VALUE[outcome] * 0.8 + MASTERY_PRIOR * 0.2;
}

export interface LessonMeta {
  id: string;
  conceptId: ConceptId;
  level: number;
}
export interface ExerciseMeta {
  id: string;
  conceptId: ConceptId;
  difficulty: number;
}
export interface PuzzleMeta {
  id: string;
  rating: number;
  themes?: string[];
}

/** Map known puzzle tags to skills. Unknown tactics are conservatively generic. */
export function puzzleConcept(themes: string[] = []): ConceptId {
  const tags = new Set(themes.map((t) => t.toLowerCase()));
  if (tags.has('hangingpiece')) return 'hanging-pieces';
  if ([...tags].some((t) => t.includes('mate') || t === 'backrankmate')) return 'rules-checkmates';
  return 'tactics';
}

/**
 * Build a daily session plan.
 * - Reviews due first (up to 30% of steps).
 * - Then weakest concepts whose prerequisites are satisfied (prereq mastery >= 0.4).
 * - Steps are ~2 minutes each: steps = floor(minutes / 2).
 * Deterministic given the same inputs (ties broken by concept order).
 */
export function planSession(
  mastery: MasteryRecord[],
  minutes: number,
  lessons: LessonMeta[],
  exercises: ExerciseMeta[],
  puzzles: PuzzleMeta[],
  now: Date = new Date(),
): SessionStep[] {
  const steps: SessionStep[] = [];
  const stepBudget = Math.max(3, Math.floor(minutes / 2));
  const byConcept = new Map<ConceptId, MasteryRecord>(mastery.map((m) => [m.conceptId, m]));
  const get = (c: ConceptId): MasteryRecord => byConcept.get(c) ?? emptyMastery(c);

  const prereqsMet = (c: ConceptId): boolean =>
    (CONCEPTS.find((x) => x.id === c)?.prerequisites ?? []).every((p) => get(p).mastery >= 0.4);

  const weakestFirst = [...CONCEPTS]
    .filter((c) => prereqsMet(c.id))
    .sort((a, b) => get(a.id).mastery - get(b.id).mastery || a.id.localeCompare(b.id));

  // 1. Reviews due.
  // Note: exercise difficulty is 0-100 (puzzle rating / 10), so scale x10 to compare with the band.
  const inBand = (difficulty0100: number, band: { min: number; max: number }): boolean => {
    const scaled = difficulty0100 * 10;
    return scaled >= band.min && scaled <= band.max;
  };
  const reviewBudget = Math.max(1, Math.floor(stepBudget * 0.3));
  const due = mastery
    .filter((m) => m.nextReviewAt && m.nextReviewAt <= now.toISOString())
    .sort((a, b) => (a.nextReviewAt ?? '').localeCompare(b.nextReviewAt ?? ''));
  for (const m of due) {
    if (steps.length >= reviewBudget || steps.length >= stepBudget) break;
    const band = difficultyBand(m.mastery);
    const ex = exercises
      .filter((e) => e.conceptId === m.conceptId && inBand(e.difficulty, band))
      .sort((a, b) => a.difficulty - b.difficulty)[0];
    if (ex) {
      steps.push({ kind: 'review', refId: ex.id, conceptId: m.conceptId, label: `Review: ${ex.id}` });
    }
  }

  // 2. Teach weakest concepts: one lesson step (lowest unfinished level) then exercises/puzzles in band.
  const usedLessons = new Set<string>();
  const usedExercises = new Set<string>();
  const usedPuzzles = new Set<string>(steps.filter((s) => s.kind === 'puzzle').map((s) => s.refId));
  for (const c of weakestFirst) {
    if (steps.length >= stepBudget) break;
    const m = get(c.id);
    if (m.mastery >= 0.85 && m.attempts >= 8) continue; // already solid
    const lesson = lessons
      .filter((l) => l.conceptId === c.id && !usedLessons.has(l.id))
      .sort((a, b) => a.level - b.level)[0];
    if (lesson && m.attempts < 4) {
      usedLessons.add(lesson.id);
      steps.push({ kind: 'lesson', refId: lesson.id, conceptId: c.id, label: `Lesson: ${lesson.id}` });
    }
    const band = difficultyBand(m.mastery);
    const exPool = exercises.filter((e) => e.conceptId === c.id && !usedExercises.has(e.id) && inBand(e.difficulty, band));
    const pzPool = puzzles.filter((p) => !usedPuzzles.has(p.id) && puzzleConcept(p.themes) === c.id && p.rating >= band.min && p.rating <= band.max);
    // Alternate exercise / puzzle for variety, deterministic order.
    const ex = exPool.sort((a, b) => a.difficulty - b.difficulty)[0];
    if (ex && steps.length < stepBudget) {
      usedExercises.add(ex.id);
      steps.push({ kind: 'exercise', refId: ex.id, conceptId: c.id, label: `Practice: ${ex.id}` });
    }
    const pz = pzPool.sort((a, b) => a.rating - b.rating)[0];
    if (pz && steps.length < stepBudget && m.mastery > 0.3) {
      usedPuzzles.add(pz.id);
      steps.push({ kind: 'puzzle', refId: pz.id, conceptId: c.id, label: `Puzzle: ${pz.id}` });
    }
  }

  return steps.slice(0, stepBudget);
}

/** Pick the next puzzle id for free practice: in-band, least recently attempted. */
export function pickNextPuzzle(
  mastery: MasteryRecord[],
  puzzles: PuzzleMeta[],
  attemptedIds: Set<string>,
  conceptFocus?: ConceptId,
): PuzzleMeta | null {
  const avg = mastery.length ? mastery.reduce((s, m) => s + m.mastery, 0) / mastery.length : 0.3;
  const band = difficultyBand(conceptFocus ? (mastery.find((m) => m.conceptId === conceptFocus)?.mastery ?? avg) : avg);
  const eligible = conceptFocus ? puzzles.filter((p) => puzzleConcept(p.themes) === conceptFocus) : puzzles;
  const fresh = eligible.filter((p) => !attemptedIds.has(p.id));
  const pool = (fresh.length ? fresh : eligible).filter((p) => p.rating >= band.min && p.rating <= band.max);
  const finalPool = pool.length ? pool : fresh.length ? fresh : eligible;
  // Deterministic: lowest rating in band first (gentlest), tie-break by id.
  return finalPool.sort((a, b) => a.rating - b.rating || a.id.localeCompare(b.id))[0] ?? null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

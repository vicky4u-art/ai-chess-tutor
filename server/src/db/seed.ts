/** Idempotent seeding of curriculum + puzzles + mastery rows. */
import type { DatabaseSync } from 'node:sqlite';
import { CONCEPTS } from '@chesstutor/shared';
import { LESSONS, EXERCISES } from '../data/curriculum.js';
import { SEED_PUZZLES } from '../data/seed-puzzles.js';
import { transaction } from './index.js';

export function seed(db: DatabaseSync): void {
  // Refresh authored material on every start; keep attempts and mastery untouched.
  {
    const ins = db.prepare(
      `INSERT INTO lessons (id, concept_id, level, title, objective, content_md, exercise_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         concept_id=excluded.concept_id, level=excluded.level,
         title=excluded.title, objective=excluded.objective,
         content_md=excluded.content_md, exercise_ids=excluded.exercise_ids`,
    );
    transaction(db, () => {
      for (const l of LESSONS) {
        ins.run(l.id, l.conceptId, l.level, l.title, l.objective, l.contentMd, JSON.stringify(l.exerciseIds));
      }
    });
  }

  {
    const ins = db.prepare(
      `INSERT INTO exercises (id, concept_id, kind, fen, prompt, solution_uci, acceptable_uci, choices, hints, explanation, difficulty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         concept_id=excluded.concept_id, kind=excluded.kind, fen=excluded.fen,
         prompt=excluded.prompt, solution_uci=excluded.solution_uci,
         acceptable_uci=excluded.acceptable_uci, choices=excluded.choices,
         hints=excluded.hints, explanation=excluded.explanation,
         difficulty=excluded.difficulty`,
    );
    transaction(db, () => {
      for (const e of EXERCISES) {
        ins.run(
          e.id, e.conceptId, e.kind, e.fen, e.prompt,
          JSON.stringify(e.solutionUci), JSON.stringify(e.acceptableUci ?? null),
          JSON.stringify(e.choices ?? null), JSON.stringify(e.hints), e.explanation, e.difficulty,
        );
      }
    });
  }

  {
    const ins = db.prepare(
      `INSERT INTO puzzles (id, source_id, fen, solution_uci, rating, themes)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         source_id=excluded.source_id, fen=excluded.fen,
         solution_uci=excluded.solution_uci,
         rating=excluded.rating, themes=excluded.themes`,
    );
    transaction(db, () => {
      for (const p of SEED_PUZZLES) {
        ins.run(p.id, p.sourceId, p.fen, JSON.stringify(p.solutionUci), p.rating, JSON.stringify(p.themes));
      }
    });
  }

  // One mastery row per concept.
  const insM = db.prepare(
    `INSERT INTO mastery (concept_id, mastery, attempts, independent_successes, streak, last_seen_at, next_review_at)
     VALUES (?, 0.2, 0, 0, 0, NULL, NULL)
     ON CONFLICT(concept_id) DO NOTHING`,
  );
  transaction(db, () => {
    for (const c of CONCEPTS) insM.run(c.id);
  });
}

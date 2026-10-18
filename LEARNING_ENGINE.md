# Learning Engine

Deterministic adaptive engine. The LLM never sets mastery scores; all progression math lives in `server/src/learning.ts` as pure, unit-tested functions.

## Skill taxonomy (15 concepts)

Beginner → intermediate. Prerequisites from `shared/src/index.ts`:

| Concept | Prerequisites |
|---|---|
| rules-checkmates | — |
| development | rules-checkmates |
| hanging-pieces | rules-checkmates |
| kpk-endgame | rules-checkmates |
| center | development |
| king-safety | development |
| activity | development |
| tactics | hanging-pieces |
| rook-endgame | kpk-endgame |
| pawn-structure | center |
| calculation | tactics |
| openings | center, king-safety |
| exchanges | activity |
| planning | activity, pawn-structure |
| decisions | calculation, planning |

Each concept has one level-1 lesson + 4 exercises in `server/src/data/curriculum.ts`.

## Mastery update rule

Outcome per attempt: `independent` (solved alone), `hinted` (used a hint), `shown` (was shown the answer).

- Outcome values: independent = **1.0**, hinted = **0.6**, shown = **0.0**
- Update: `m <- m + k*(outcome - m)`, clamped to **[0.02, 0.98]**
  - k: independent = **0.12**, hinted = **0.06**, shown = **0.10**
- Prior: **m = 0.2** for unseen concepts (`MASTERY_PRIOR`, `emptyMastery`)
- `attempts` increments every attempt; `independentSuccesses` only on `independent`

Worked example: m=0.2, independent success → m = 0.2 + 0.12*(1.0-0.2) = 0.296.

## Difficulty selection

- `estimatedStrength = 400 + mastery*1600` (pseudo-rating for matching only; never presented as Elo)
- Target band: **±150** around estimatedStrength (`difficultyBand(m, 150)`)
- Exercises use `difficulty` on a 0–100 scale (puzzle rating / 10); the planner scales ×10 to compare with the band (`inBand` in `planSession`). Puzzles use `rating` directly.

## Spaced review

- On each attempt: streak increments unless outcome is `shown` (which resets streak to 0)
- `interval_days = clamp(2^streak, 1, 60)`
- `nextReviewAt = now + interval_days`
- Reviews surface in the daily planner when `nextReviewAt <= now`

## Assessment seeding

New learners take a short assessment; each item's outcome seeds mastery directly:

`m = outcome_value*0.8 + 0.2*0.2`

so an independent success seeds 0.84, hinted 0.52, shown 0.04→clamped 0.04. Concepts with <3 data points are flagged `uncertain` in `AssessmentResult` — treat their mastery as provisional.

## Daily session planner (`planSession`)

1. **Reviews due first**, capped at 30% of steps (min 1 step).
2. Then **weakest concepts with satisfied prerequisites** (every prereq mastery ≥ 0.4), weakest-first.
3. Steps ≈ `floor(minutes / 2)` (each step ~2 min), minimum 3 steps.
4. Per concept: lesson step (if attempts < 4), then an in-band exercise, then an in-band puzzle (only if mastery > 0.3). Concepts at mastery ≥ 0.85 with ≥ 8 attempts are skipped.
5. Deterministic given the same inputs (ties broken by concept id order).

## Game-analysis classification (`routes.ts`: `classify`)

Per move, from the mover's perspective: `cpLoss = max(0, evalCp_before - evalCp_after)` vs engine best.

- `cpLoss < 30` → `best` (if matches engine move) else `good`
- `cpLoss < 80` → `good`
- `80–150` → `inaccuracy`
- `150–300` → `mistake`
- `> 300` → `blunder`
- `ply <= 8 && cpLoss < 50` → `book` (theory, overrides)

## Concept-linking heuristics (`routes.ts`: `linkConcepts`)

Only `mistake`/`blunder` moves are linked, and links are sparse by design — no link means "ambiguous", never force an attribution:

1. **Missed mate in 1** (a legal move would have checkmated) → `tactics`, confidence 0.65
2. **Move allows opponent to capture a piece worth ≥ 3** → `hanging-pieces`, confidence 0.55
3. **King still central (d/e 1–2 / 7–8) after move 12** → `king-safety`, confidence 0.50
4. Otherwise → no link

Uncertainty policy: dashboard counts only links with confidence ≥ 0.5 toward `recurringMistakes`; low-confidence links are stored but not used for planning.

## How to modify the logic

Edit `server/src/learning.ts` (mastery, bands, planner) or `routes.ts` `classify`/`linkConcepts` (analysis). Add/adjust unit tests in `server/tests/learning.test.ts`. Keep functions pure and deterministic; update this doc when constants change.

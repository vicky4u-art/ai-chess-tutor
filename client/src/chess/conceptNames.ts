/**
 * Display names for the 15-concept taxonomy (mirrors CONCEPTS in
 * @chesstutor/shared).
 *
 * This is a static table on purpose: the Vite production build cannot import
 * *runtime values* from `@chesstutor/shared` — the workspace symlink resolves
 * to `<root>/shared/dist/index.js` outside the client root, and Rollup then
 * treats that CJS file as ESM ("X is not exported by ..."). Type-only imports
 * are fine (they are erased at compile time).
 *
 * Where the server provides names (GET /api/concepts, DashboardData), prefer
 * those; use this table as the offline/display fallback.
 */
import type { ConceptId } from '@chesstutor/shared';

export const CONCEPT_NAMES: Record<ConceptId, string> = {
  'rules-checkmates': 'Rules & fundamental checkmates',
  development: 'Piece development',
  center: 'Center control',
  'king-safety': 'King safety',
  'hanging-pieces': 'Hanging pieces & blunder prevention',
  tactics: 'Tactical patterns',
  calculation: 'Calculation & visualization',
  openings: 'Opening principles',
  activity: 'Piece activity',
  'pawn-structure': 'Pawn structures',
  planning: 'Middlegame planning',
  exchanges: 'Exchanges & material imbalances',
  'kpk-endgame': 'King & pawn endgames',
  'rook-endgame': 'Rook endgames',
  decisions: 'Practical decision-making',
};

export function conceptName(id: ConceptId): string {
  return CONCEPT_NAMES[id] ?? id;
}

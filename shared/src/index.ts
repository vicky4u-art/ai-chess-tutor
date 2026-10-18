/**
 * Shared contract between client and server.
 * Single source of truth for the concept taxonomy, learning data shapes,
 * and the HTTP API. Both workspaces import from here.
 */

// ---------------------------------------------------------------------------
// Concept taxonomy (15 concepts, beginner -> intermediate)
// ---------------------------------------------------------------------------

export type ConceptId =
  | 'rules-checkmates'
  | 'development'
  | 'center'
  | 'king-safety'
  | 'hanging-pieces'
  | 'tactics'
  | 'calculation'
  | 'openings'
  | 'activity'
  | 'pawn-structure'
  | 'planning'
  | 'exchanges'
  | 'kpk-endgame'
  | 'rook-endgame'
  | 'decisions';

export interface Concept {
  id: ConceptId;
  name: string;
  blurb: string;
  prerequisites: ConceptId[];
}

export const CONCEPTS: Concept[] = [
  { id: 'rules-checkmates', name: 'Rules & fundamental checkmates', blurb: 'How the pieces move, special rules, and mating with queen/rook vs a lone king.', prerequisites: [] },
  { id: 'development', name: 'Piece development', blurb: 'Bringing pieces into play quickly and harmoniously in the opening.', prerequisites: ['rules-checkmates'] },
  { id: 'center', name: 'Center control', blurb: 'Fighting for e4/d4/e5/d5 with pawns and pieces.', prerequisites: ['development'] },
  { id: 'king-safety', name: 'King safety', blurb: 'Castling early, pawn shelter, and recognizing mating attacks.', prerequisites: ['development'] },
  { id: 'hanging-pieces', name: 'Hanging pieces & blunder prevention', blurb: 'Spotting undefended pieces and checking every move for tactics.', prerequisites: ['rules-checkmates'] },
  { id: 'tactics', name: 'Tactical patterns', blurb: 'Forks, pins, skewers, discovered attacks, double attacks.', prerequisites: ['hanging-pieces'] },
  { id: 'calculation', name: 'Calculation & visualization', blurb: 'Forcing sequences, candidate moves, seeing 3-5 moves deep.', prerequisites: ['tactics'] },
  { id: 'openings', name: 'Opening principles', blurb: 'Sound opening play built on development, center, and king safety.', prerequisites: ['center', 'king-safety'] },
  { id: 'activity', name: 'Piece activity', blurb: 'Active vs passive pieces, outposts, open files and diagonals.', prerequisites: ['development'] },
  { id: 'pawn-structure', name: 'Pawn structures', blurb: 'Isolated, doubled, passed pawns; pawn breaks and majorities.', prerequisites: ['center'] },
  { id: 'planning', name: 'Middlegame planning', blurb: 'Forming a plan from pawn structure and piece activity.', prerequisites: ['activity', 'pawn-structure'] },
  { id: 'exchanges', name: 'Exchanges & material imbalances', blurb: 'When to trade, bishop vs knight, queen vs rooks, sacrifices.', prerequisites: ['activity'] },
  { id: 'kpk-endgame', name: 'King & pawn endgames', blurb: 'Opposition, the square rule, key squares, triangulation.', prerequisites: ['rules-checkmates'] },
  { id: 'rook-endgame', name: 'Rook endgames', blurb: 'Lucena, Philidor, rook activity, cutting off the king.', prerequisites: ['kpk-endgame'] },
  { id: 'decisions', name: 'Practical decision-making', blurb: 'Time management, risk, simplifying when ahead, technique.', prerequisites: ['calculation', 'planning'] },
];

export const CONCEPT_MAP: Record<ConceptId, Concept> = Object.fromEntries(
  CONCEPTS.map((c) => [c.id, c]),
) as Record<ConceptId, Concept>;

// ---------------------------------------------------------------------------
// Mastery / learning state
// ---------------------------------------------------------------------------

export type AttemptOutcome = 'independent' | 'hinted' | 'shown';

export interface MasteryRecord {
  conceptId: ConceptId;
  /** 0..1 estimated proficiency. Never presented as an Elo rating. */
  mastery: number;
  attempts: number;
  independentSuccesses: number;
  lastSeenAt: string | null;
  nextReviewAt: string | null;
}

export function emptyMastery(conceptId: ConceptId): MasteryRecord {
  return { conceptId, mastery: 0.2, attempts: 0, independentSuccesses: 0, lastSeenAt: null, nextReviewAt: null };
}

// ---------------------------------------------------------------------------
// Curriculum
// ---------------------------------------------------------------------------

export type ExerciseKind = 'find-move' | 'choose-move' | 'yes-no';

export interface Exercise {
  id: string;
  conceptId: ConceptId;
  kind: ExerciseKind;
  /** Position before the learner moves. Side to move is encoded in the FEN. */
  fen: string;
  prompt: string;
  /** Primary solution as UCI move strings, in order (for multi-move sequences). */
  solutionUci: string[];
  /** Alternative acceptable first moves (each a list of UCI strings). */
  acceptableUci?: string[][];
  /** For choose-move: UCI options to present. For yes-no: ignored. */
  choices?: string[];
  /** Exactly 3 hints, weakest -> strongest. */
  hints: [string, string, string];
  explanation: string;
  /** 0..100, calibrated like puzzle ratings / 10 for rough comparability. */
  difficulty: number;
}

export interface Lesson {
  id: string;
  conceptId: ConceptId;
  level: 1 | 2 | 3;
  title: string;
  objective: string;
  /** Markdown explanation shown before exercises. */
  contentMd: string;
  exerciseIds: string[];
}

// ---------------------------------------------------------------------------
// Puzzles (curated subset of a public puzzle dataset + generated seeds)
// ---------------------------------------------------------------------------

export interface Puzzle {
  id: string;
  sourceId: string;
  fen: string;
  /** Full solution line as UCI moves, alternating learner/opponent. */
  solutionUci: string[];
  rating: number;
  themes: string[];
}

// ---------------------------------------------------------------------------
// Assessment
// ---------------------------------------------------------------------------

export interface AssessmentItem {
  exerciseId: string;
  conceptId: ConceptId;
  difficulty: number;
}

export interface AssessmentResult {
  assessmentId: string;
  finishedAt: string;
  profile: MasteryRecord[];
  /** Concepts with fewer than 3 data points — treat mastery as uncertain. */
  uncertain: ConceptId[];
}

// ---------------------------------------------------------------------------
// Daily sessions
// ---------------------------------------------------------------------------

export type SessionStepKind = 'review' | 'lesson' | 'exercise' | 'puzzle';

export interface SessionStep {
  kind: SessionStepKind;
  refId: string; // lessonId | exerciseId | puzzleId
  conceptId: ConceptId;
  label: string;
}

export interface DailySession {
  id: string;
  minutes: number;
  startedAt: string;
  status: 'active' | 'paused' | 'completed';
  plan: SessionStep[];
  completedStepIndexes: number[];
}

// ---------------------------------------------------------------------------
// Games & analysis
// ---------------------------------------------------------------------------

export interface GameMove {
  ply: number;
  san: string;
  uci: string;
  fenBefore: string;
  /** Centipawn eval from the side-to-move's perspective, if analyzed. */
  evalCp: number | null;
  /** Centipawns lost vs the engine's best move, if analyzed. */
  cpLoss: number | null;
  classification: 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | 'book' | 'unanalyzed';
  /** Concept links with confidence; null confidence = ambiguous, do not over-assign. */
  conceptLinks: { conceptId: ConceptId; confidence: number }[];
}

export interface ImportedGame {
  id: string;
  source: 'pgn-upload' | 'chesscom' | 'lichess';
  white: string;
  black: string;
  result: string;
  importedAt: string;
  moveCount: number;
  analyzed: boolean;
}

export interface ChesscomImportRequest {
  username: string;
  /** Max recent games to pull (1-200, default 30). */
  maxGames?: number;
}

export interface ChesscomImportResponse {
  username: string;
  /** Games seen in the fetched archives (before dedup). */
  fetched: number;
  imported: number;
  /** Already imported before, or unparseable. */
  skipped: number;
  games: ImportedGame[];
}

// ---------------------------------------------------------------------------
// AI tutor
// ---------------------------------------------------------------------------

export interface TutorMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TutorChatRequest {
  messages: TutorMessage[];
  /** Current board position. */
  fen: string;
  /** Optional client-side engine read of the position. */
  engine?: { bestUci: string; evalCp: number; depth: number } | null;
  /** Learner context the server injects (never trust client mastery). */
  sessionId?: string;
}

export interface TutorChatResponse {
  reply: string;
  /** True when an AI provider is configured and answered. */
  aiConfigured: boolean;
  /** Move strings the server validated against the FEN with chess.js. */
  validatedMoves: string[];
}

// ---------------------------------------------------------------------------
// Progress dashboard
// ---------------------------------------------------------------------------

export interface DashboardData {
  concepts: (MasteryRecord & { name: string })[];
  strongest: ConceptId[];
  weakest: ConceptId[];
  recentSessions: { id: string; minutes: number; startedAt: string; status: string; stepsDone: number; stepsTotal: number }[];
  accuracyIndependent: number; // 0..1 over last 50 exercise/puzzle attempts
  reviewsDue: number;
  recurringMistakes: { conceptId: ConceptId; count: number }[];
  masteryTrend: { date: string; avgMastery: number }[];
  nextPriorities: { conceptId: ConceptId; reason: string }[];
}

// ---------------------------------------------------------------------------
// HTTP API (server implements, client consumes)
// ---------------------------------------------------------------------------

export const API_VERSION = '0.1.0';

export interface ApiError {
  error: string;
  detail?: string;
}

/**
 * Typed fetch wrapper for the AI Chess Tutor HTTP API.
 *
 * Endpoint shapes are implied by `@chesstutor/shared` (which defines the
 * data types but not the routes). Route paths and a few envelope shapes
 * below are this client's assumptions — see the build report for the list
 * of contract gaps the server must match.
 */
import type {
  ApiError,
  AssessmentItem,
  AssessmentResult,
  AttemptOutcome,
  Concept,
  DailySession,
  DashboardData,
  Exercise,
  ImportedGame,
  GameMove,
  Lesson,
  Puzzle,
  TutorChatRequest,
  TutorChatResponse,
} from '@chesstutor/shared';

const BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001';

const TOKEN: string | undefined = import.meta.env.VITE_APP_TOKEN as string | undefined;

export class ChessApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ChessApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch (e) {
    throw new ChessApiError(0, `Network error: could not reach the server (${(e as Error).message})`);
  }
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const apiErr = body as ApiError | null;
    const message =
      apiErr && typeof apiErr === 'object' && 'error' in apiErr && typeof apiErr.error === 'string'
        ? apiErr.detail
          ? `${apiErr.error}: ${apiErr.detail}`
          : apiErr.error
        : `Request failed (${res.status})`;
    throw new ChessApiError(res.status, message);
  }
  return body as T;
}

const get = <T,>(path: string): Promise<T> => request<T>(path);
const post = <T,>(path: string, data?: unknown): Promise<T> =>
  request<T>(path, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) });
const put = <T,>(path: string, data: unknown): Promise<T> =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(data) });

// ---------------------------------------------------------------------------
// Local shapes (not in shared/): envelopes the client assumes the server uses
// ---------------------------------------------------------------------------

export interface Health {
  status: string;
  version: string;
}

export interface Diagnostics {
  version: string;
  aiConfigured: boolean;
  serverTime: string;
}

export interface Profile {
  displayName: string | null;
  createdAt: string;
}

export interface AssessmentStart {
  assessmentId: string;
  items: AssessmentItem[];
  exercises: Exercise[];
}

export interface AssessmentAnswerRequest {
  assessmentId: string;
  exerciseId: string;
  outcome: AttemptOutcome;
  timeMs: number;
  hintsUsed: number;
  playedUci?: string;
}

export interface AssessmentAnswerResponse {
  correct: boolean;
  expectedUci: string[];
}

export interface LessonDetail {
  lesson: Lesson;
  exercises: Exercise[];
}

export interface PuzzleDetail extends Puzzle {
  hints: [string, string, string];
  explanation: string;
}

export interface ExerciseAttemptRequest {
  outcome: AttemptOutcome;
  timeMs: number;
  hintsUsed: number;
  playedUci?: string;
}

export interface ExerciseAttemptResponse {
  correct: boolean;
}

export interface PuzzleAttemptRequest {
  solved: boolean;
  outcome: AttemptOutcome;
  timeMs: number;
  hintsUsed: number;
  movesPlayed: string[];
}

export interface PuzzleAttemptResponse {
  correct: boolean;
  solutionUci: string[];
}

export interface GameDetail {
  game: ImportedGame;
  pgn: string;
  moves: GameMove[];
}

/** One client-side engine read, sent to the server for classification. */
export interface EngineEval {
  ply: number;
  evalCp: number;
  bestUci: string;
  depth: number;
}

export interface AnalyzeResponse {
  moves: GameMove[];
}

// ---------------------------------------------------------------------------
// API surface
// ---------------------------------------------------------------------------

export const api = {
  health: () => get<Health>('/api/health'),
  diagnostics: () => get<Diagnostics>('/api/diagnostics'),

  getProfile: () => get<Profile>('/api/profile'),
  updateProfile: (displayName: string) => put<Profile>('/api/profile', { displayName }),

  startAssessment: () => post<AssessmentStart>('/api/assessment/start'),
  answerAssessment: (req: AssessmentAnswerRequest) =>
    post<AssessmentAnswerResponse>('/api/assessment/answer', req),
  finishAssessment: (assessmentId: string) =>
    post<AssessmentResult>('/api/assessment/finish', { assessmentId }),

  getConcepts: () => get<Concept[]>('/api/concepts'),
  getLessons: (conceptId?: string) =>
    get<Lesson[]>(`/api/lessons${conceptId ? `?conceptId=${encodeURIComponent(conceptId)}` : ''}`),
  getLesson: (id: string) => get<LessonDetail>(`/api/lessons/${encodeURIComponent(id)}`),
  getExercise: (id: string) => get<Exercise>(`/api/exercises/${encodeURIComponent(id)}`),
  attemptExercise: (id: string, req: ExerciseAttemptRequest) =>
    post<ExerciseAttemptResponse>(`/api/exercises/${encodeURIComponent(id)}/attempt`, req),

  startSession: (minutes: number) => post<DailySession>('/api/sessions/start', { minutes }),
  getSession: (id: string) => get<DailySession>(`/api/sessions/${encodeURIComponent(id)}`),
  pauseSession: (id: string) => post<DailySession>(`/api/sessions/${encodeURIComponent(id)}/pause`),
  resumeSession: (id: string) => post<DailySession>(`/api/sessions/${encodeURIComponent(id)}/resume`),
  completeSessionStep: (id: string, stepIndex: number) =>
    post<DailySession>(`/api/sessions/${encodeURIComponent(id)}/complete-step`, { stepIndex }),

  nextPuzzle: () => get<PuzzleDetail>('/api/puzzles/next'),
  getPuzzle: (id: string) => get<PuzzleDetail>(`/api/puzzles/${encodeURIComponent(id)}`),
  attemptPuzzle: (id: string, req: PuzzleAttemptRequest) =>
    post<PuzzleAttemptResponse>(`/api/puzzles/${encodeURIComponent(id)}/attempt`, req),

  importGame: (pgn: string, source: ImportedGame['source'] = 'pgn-upload') =>
    post<GameDetail>('/api/games/import', { pgn, source }),
  listGames: () => get<ImportedGame[]>('/api/games'),
  getGame: (id: string) => get<GameDetail>(`/api/games/${encodeURIComponent(id)}`),
  analyzeGame: (id: string, evals: EngineEval[]) =>
    post<AnalyzeResponse>(`/api/games/${encodeURIComponent(id)}/analyze`, { evals }),

  tutorChat: (req: TutorChatRequest) => post<TutorChatResponse>('/api/tutor/chat', req),

  getProgress: () => get<DashboardData>('/api/progress'),
  exportData: () => get<Record<string, unknown>>('/api/export'),
};

export { BASE_URL };

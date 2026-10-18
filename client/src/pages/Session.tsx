/** Daily session runner: walks the plan steps, tracks completion, pause/resume. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { AttemptOutcome, DailySession, Exercise, Lesson, SessionStep } from '@chesstutor/shared';
import { conceptName } from '../chess/conceptNames';
import { api, ChessApiError, PuzzleDetail } from '../api';
import { ChessboardView } from '../components/Chessboard';
import { ExerciseRunner, AttemptResult } from '../components/ExerciseRunner';
import { Btn, Card, ErrorBox, Loading, Markdown, SectionTitle } from '../components/ui';
import { uciParts } from '../chess/useChessGame';

function StepLabel({ step }: { step: SessionStep }) {
  return (
    <p className="text-sm text-slate-300">
      <span className="text-slate-500 uppercase text-xs mr-2">{step.kind}</span>
      {step.label}
      <span className="text-slate-500"> · {conceptName(step.conceptId)}</span>
    </p>
  );
}

function PuzzleStep({ puzzle, onDone }: { puzzle: PuzzleDetail; onDone: (solved: boolean, outcome: AttemptOutcome, hintsUsed: number, moves: string[], timeMs: number) => void }) {
  const [applied, setApplied] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [solved, setSolved] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const startRef = useRef(Date.now());
  const doneRef = useRef(false);

  const boardFen = useMemo(() => {
    const g = new Chess(puzzle.fen);
    for (const u of applied) {
      const { from, to, promotion } = uciParts(u);
      try { g.move({ from, to, promotion }); } catch { break; }
    }
    return g.fen();
  }, [puzzle.fen, applied]);

  const finishOnce = (s: boolean, outcome: AttemptOutcome, moves: string[]) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone(s, outcome, hintLevel, moves, Date.now() - startRef.current);
  };

  const handleMove = (from: string, to: string, promotion?: string): boolean => {
    if (solved || failed) return false;
    const played = `${from}${to}${promotion ?? ''}`.toLowerCase();
    const expected = puzzle.solutionUci[applied.length]?.toLowerCase();
    try {
      const g = new Chess(boardFen);
      const { from: f, to: t, promotion: pr } = uciParts(played);
      g.move({ from: f, to: t, promotion: pr });
    } catch { return false; }
    if (played !== expected) {
      setFailed(true);
      finishOnce(false, hintLevel === 0 ? 'independent' : 'hinted', [played]);
      return true;
    }
    const next = [...applied, puzzle.solutionUci[applied.length]];
    // Auto-play the single opponent reply (solution alternates learner/opponent).
    if (next.length < puzzle.solutionUci.length) {
      next.push(puzzle.solutionUci[next.length]);
    }
    setApplied(next);
    if (next.length >= puzzle.solutionUci.length) {
      setSolved(true);
      finishOnce(true, hintLevel === 0 ? 'independent' : 'hinted', next);
    }
    return true;
  };

  const done = solved || failed;
  return (
    <Card>
      <p className="text-slate-200 text-[15px] mb-3">{done ? (solved ? 'Solved.' : 'Missed — solution shown.') : 'Solve the puzzle.'}</p>
      <div className="flex justify-center mb-3">
        <ChessboardView id={`sess-pz-${puzzle.id}`} fen={boardFen} onMove={handleMove} allowMoves={!done} dimmed={done} />
      </div>
      {!done && (
        <Btn variant="subtle" onClick={() => setHintLevel((h) => Math.min(3, h + 1))} disabled={hintLevel >= 3}>
          {hintLevel === 0 ? 'Hint' : `Hint ${hintLevel}/3`}
        </Btn>
      )}
      {hintLevel > 0 && !done && (
        <div className="mt-2 space-y-1">
          {puzzle.hints.slice(0, hintLevel).map((h, i) => (
            <p key={i} className="text-sm text-amber-200/90">Hint {i + 1}: {h}</p>
          ))}
        </div>
      )}
      {done && <p className="text-sm text-slate-300 mt-2">{puzzle.explanation}</p>}
    </Card>
  );
}

export function Session({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<DailySession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stepData, setStepData] = useState<{ exercise?: Exercise; lesson?: Lesson; puzzle?: PuzzleDetail } | null>(null);
  const [stepLoading, setStepLoading] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api
      .getSession(sessionId)
      .then(setSession)
      .catch((e: unknown) => setError(e instanceof ChessApiError ? e.message : 'Could not load the session.'));
  }, [sessionId]);

  useEffect(load, [load]);

  const doneSet = useMemo(() => new Set(session?.completedStepIndexes ?? []), [session]);
  const currentIndex = session ? session.plan.findIndex((_, i) => !doneSet.has(i)) : -1;
  const current: SessionStep | null = session && currentIndex >= 0 ? session.plan[currentIndex] : null;

  useEffect(() => {
    if (!current) {
      setStepData(null);
      return;
    }
    setStepLoading(true);
    setStepData(null);
    const p: Promise<unknown> =
      (current.kind === 'exercise' || current.kind === 'review')
        ? api.getExercise(current.refId).then((exercise) => ({ exercise }))
        : current.kind === 'puzzle'
          ? api.getPuzzle(current.refId).then((puzzle) => ({ puzzle }))
          : api.getLesson(current.refId).then((d) => ({ lesson: d.lesson }));
    p.then((d) => setStepData(d as { exercise?: Exercise; lesson?: Lesson; puzzle?: PuzzleDetail }))
      .catch((e: unknown) => setError(e instanceof ChessApiError ? e.message : 'Could not load the step.'))
      .finally(() => setStepLoading(false));
  }, [current?.refId, current?.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const completeStep = useCallback(
    async (idx: number) => {
      try {
        const s = await api.completeSessionStep(sessionId, idx);
        setSession(s);
      } catch (e) {
        setError(e instanceof ChessApiError ? e.message : 'Could not save progress.');
      }
    },
    [sessionId],
  );

  const pause = async () => {
    try {
      setSession(await api.pauseSession(sessionId));
    } catch (e) {
      setError(e instanceof ChessApiError ? e.message : 'Pause failed.');
    }
  };
  const resume = async () => {
    try {
      setSession(await api.resumeSession(sessionId));
    } catch (e) {
      setError(e instanceof ChessApiError ? e.message : 'Resume failed.');
    }
  };

  const handleExerciseDone = (ex: Exercise) => async (r: AttemptResult) => {
    try {
      await api.attemptExercise(ex.id, { outcome: r.outcome, timeMs: r.timeMs, hintsUsed: r.hintsUsed, playedUci: r.playedUci });
    } catch (e) {
      setError(e instanceof ChessApiError ? e.message : 'Could not save exercise result. Reload and retry this step.');
      return;
    }
    if (currentIndex >= 0) await completeStep(currentIndex);
  };

  const handlePuzzleDone = (pz: PuzzleDetail) => async (solved: boolean, outcome: AttemptOutcome, hintsUsed: number, moves: string[], timeMs: number) => {
    try {
      await api.attemptPuzzle(pz.id, { solved, outcome, timeMs, hintsUsed, movesPlayed: moves });
    } catch (e) {
      setError(e instanceof ChessApiError ? e.message : 'Could not save puzzle result. Reload and retry this step.');
      return;
    }
    if (currentIndex >= 0) await completeStep(currentIndex);
  };

  if (error && !session) return <div className="p-4"><ErrorBox message={error} onRetry={load} /></div>;
  if (!session) return <div className="p-4"><Loading label="Loading session" /></div>;

  if (currentIndex === -1) {
    return (
      <div className="p-4 pb-24 space-y-4">
        <Card>
          <SectionTitle>Session complete</SectionTitle>
          <p className="text-sm text-slate-300 mb-4">
            You finished all {session.plan.length} steps of this {session.minutes}-minute session.
          </p>
          <Btn onClick={() => (window.location.hash = '#/dashboard')} className="w-full">
            Back to dashboard
          </Btn>
        </Card>
      </div>
    );
  }

  const paused = session.status === 'paused';

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Step {currentIndex + 1} of {session.plan.length} · {session.minutes} min session
        </p>
        {paused ? <Btn variant="ghost" onClick={resume}>Resume</Btn> : <Btn variant="ghost" onClick={pause}>Pause</Btn>}
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full bg-amber-400 transition-all" style={{ width: `${(doneSet.size / session.plan.length) * 100}%` }} />
      </div>

      {paused && (
        <Card className="border-amber-900">
          <p className="text-amber-200 text-sm">Paused. Your progress is saved — resume any time.</p>
        </Card>
      )}

      {error && <ErrorBox message={error} />}

      {!paused && current && <StepLabel step={current} />}

      {!paused && stepLoading && <Loading label="Loading step" />}

      {!paused && !stepLoading && (current?.kind === 'exercise' || current?.kind === 'review') && stepData?.exercise && (
        <ExerciseRunner key={stepData.exercise.id} exercise={stepData.exercise} onDone={handleExerciseDone(stepData.exercise)} />
      )}

      {!paused && !stepLoading && current?.kind === 'puzzle' && stepData?.puzzle && (
        <PuzzleStep puzzle={stepData.puzzle} onDone={handlePuzzleDone(stepData.puzzle)} />
      )}

      {!paused && !stepLoading && current?.kind === 'lesson' && stepData?.lesson && (
        <Card>
          <p className="text-xs text-amber-300/80 uppercase tracking-wide mb-1">Lesson</p>
          <h3 className="text-lg font-semibold text-slate-100 mb-1">{stepData.lesson.title}</h3>
          <p className="text-sm text-slate-400 mb-3">{stepData.lesson.objective}</p>
          <Markdown text={stepData.lesson.contentMd.slice(0, 1200)} />
          <div className="flex gap-2 mt-4 flex-wrap">
            <Btn variant="ghost" onClick={() => (window.location.hash = `#/learn/${stepData.lesson!.id}`)}>
              Open full lesson
            </Btn>
            <Btn onClick={() => completeStep(currentIndex)}>Mark step done</Btn>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle>Plan</SectionTitle>
        <ol className="space-y-1">
          {session.plan.map((s, i) => (
            <li key={i} className={`text-sm ${i === currentIndex ? 'text-slate-100' : 'text-slate-500'}`}>
              {doneSet.has(i) ? '✓ ' : `${i + 1}. `}{s.label}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

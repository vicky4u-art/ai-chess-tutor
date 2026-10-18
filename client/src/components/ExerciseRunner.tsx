/**
 * ExerciseRunner — renders one Exercise (find-move / choose-move / yes-no)
 * on an interactive board with 3 hint levels, then reports the attempt.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { AttemptOutcome, Exercise } from '@chesstutor/shared';
import { ChessboardView } from './Chessboard';
import { Btn, Card } from './ui';
import { uciParts } from '../chess/useChessGame';

export interface AttemptResult {
  outcome: AttemptOutcome;
  timeMs: number;
  hintsUsed: number;
  playedUci?: string;
  /** Client-side correctness check against solution/acceptable lists. */
  correct: boolean;
}

function sanFor(fen: string, uci: string): string {
  try {
    const g = new Chess(fen);
    const { from, to, promotion } = uciParts(uci);
    const m = g.move({ from, to, promotion });
    return m.san;
  } catch {
    return uci;
  }
}

function matchesSolution(ex: Exercise, playedUci: string): boolean {
  const norm = (u: string) => u.toLowerCase();
  if (ex.solutionUci.some((s) => norm(s) === norm(playedUci))) return true;
  return (ex.acceptableUci ?? []).some((alt) => alt.some((s) => norm(s) === norm(playedUci)));
}

export function ExerciseRunner({
  exercise,
  onDone,
  compact = false,
}: {
  exercise: Exercise;
  onDone: (r: AttemptResult) => void;
  compact?: boolean;
}) {
  const [fen, setFen] = useState(exercise.fen);
  const [hintLevel, setHintLevel] = useState(0); // 0 = none, 1..3 shown
  const [finished, setFinished] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [playedSan, setPlayedSan] = useState<string | null>(null);
  const startRef = useRef(Date.now());

  useEffect(() => {
    setFen(exercise.fen);
    setHintLevel(0);
    setFinished(false);
    setCorrect(null);
    setPlayedSan(null);
    startRef.current = Date.now();
  }, [exercise.id, exercise.fen]);

  const timeMs = () => Date.now() - startRef.current;
  const outcome = (): AttemptOutcome => (hintLevel === 0 ? 'independent' : 'hinted');

  const finish = (ok: boolean, playedUci?: string, san?: string) => {
    setFinished(true);
    setCorrect(ok);
    if (san) setPlayedSan(san);
    onDone({ outcome: outcome(), timeMs: timeMs(), hintsUsed: hintLevel, playedUci, correct: ok });
  };

  const handleMove = (from: string, to: string, promotion?: string): boolean => {
    if (finished) return false;
    const playedUci = `${from}${to}${promotion ?? ''}`;
    let san: string;
    let nextFen: string;
    try {
      const g = new Chess(fen);
      san = g.move({ from, to, promotion }).san;
      nextFen = g.fen();
    } catch {
      return false; // illegal — board snaps back
    }
    const ok = matchesSolution(exercise, playedUci);
    setFen(nextFen);
    finish(ok, playedUci, san);
    return true;
  };

  const answerYesNo = (yes: boolean) => {
    if (finished) return;
    // Convention: solutionUci ["yes"] means the answer is yes, ["no"] means no.
    const expected = (exercise.solutionUci[0] ?? '').toLowerCase();
    const ok = (yes && expected === 'yes') || (!yes && expected === 'no');
    finish(ok, yes ? 'yes' : 'no');
  };

  const chooseMove = (uci: string) => {
    if (finished) return;
    const ok = matchesSolution(exercise, uci);
    finish(ok, uci, sanFor(exercise.fen, uci));
  };

  const showSolution = () => {
    const sol = exercise.solutionUci[0];
    const { from, to, promotion } = uciParts(sol);
    let san: string | null = null;
    try {
      const g = new Chess(exercise.fen);
      san = g.move({ from, to, promotion }).san;
      setFen(g.fen());
    } catch {
      /* leave board as-is */
    }
    setFinished(true);
    setCorrect(false);
    if (san) setPlayedSan(san);
    onDone({ outcome: 'shown', timeMs: timeMs(), hintsUsed: hintLevel, playedUci: sol, correct: false });
  };

  const choices = useMemo(() => exercise.choices ?? [], [exercise.choices]);

  return (
    <Card className={compact ? 'p-3' : ''}>
      <p className="text-slate-200 text-[15px] mb-3">{exercise.prompt}</p>
      <div className="flex justify-center mb-3">
        <ChessboardView
          id={`ex-${exercise.id}`}
          fen={fen}
          onMove={exercise.kind === 'find-move' ? handleMove : undefined}
          allowMoves={exercise.kind === 'find-move' && !finished}
        />
      </div>

      {exercise.kind === 'choose-move' && !finished && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {choices.map((uci) => (
            <Btn key={uci} variant="ghost" onClick={() => chooseMove(uci)}>
              {sanFor(exercise.fen, uci)}
            </Btn>
          ))}
        </div>
      )}

      {exercise.kind === 'yes-no' && !finished && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Btn variant="ghost" onClick={() => answerYesNo(true)}>
            Yes
          </Btn>
          <Btn variant="ghost" onClick={() => answerYesNo(false)}>
            No
          </Btn>
        </div>
      )}

      {!finished && (
        <div className="flex items-center gap-2 flex-wrap">
          <Btn variant="subtle" onClick={() => setHintLevel((h) => Math.min(3, h + 1))} disabled={hintLevel >= 3}>
            {hintLevel === 0 ? 'Hint' : `Hint ${hintLevel}/3 — stronger`}
          </Btn>
          <Btn variant="subtle" onClick={showSolution}>
            Show solution
          </Btn>
        </div>
      )}

      {hintLevel > 0 && !finished && (
        <div className="mt-3 space-y-2">
          {exercise.hints.slice(0, hintLevel).map((h, i) => (
            <p key={i} className="text-sm text-amber-200/90 bg-amber-950/40 border border-amber-900/60 rounded-lg p-2">
              <span className="font-medium">Hint {i + 1}:</span> {h}
            </p>
          ))}
        </div>
      )}

      {finished && (
        <div className="mt-3">
          <p className={`font-medium mb-1 ${correct ? 'text-emerald-300' : 'text-red-300'}`}>
            {correct
              ? hintLevel === 0
                ? 'Correct — solved independently.'
                : 'Correct — solved with hints.'
              : playedSan
                ? `Not quite — you played ${playedSan}.`
                : 'Solution shown.'}
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">{exercise.explanation}</p>
        </div>
      )}
    </Card>
  );
}

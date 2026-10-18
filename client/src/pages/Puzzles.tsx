/** Adaptive puzzle practice: full solution lines vs auto opponent replies. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { AttemptOutcome } from '@chesstutor/shared';
import { api, ChessApiError, PuzzleDetail } from '../api';
import { ChessboardView } from '../components/Chessboard';
import { Btn, Card, ErrorBox, Loading, SectionTitle } from '../components/ui';
import { uciParts } from '../chess/useChessGame';

function applyLine(fen: string, ucis: string[]): string {
  const g = new Chess(fen);
  for (const u of ucis) {
    const { from, to, promotion } = uciParts(u);
    try {
      g.move({ from, to, promotion });
    } catch {
      break;
    }
  }
  return g.fen();
}

export function Puzzles() {
  const [puzzle, setPuzzle] = useState<PuzzleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<string[]>([]); // solution moves already on board
  const [failed, setFailed] = useState(false);
  const [solved, setSolved] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const startRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    setError(null);
    setPuzzle(null);
    setApplied([]);
    setFailed(false);
    setSolved(false);
    setHintLevel(0);
    setSubmitted(false);
    startRef.current = Date.now();
    api
      .nextPuzzle()
      .then(setPuzzle)
      .catch((e: unknown) => setError(e instanceof ChessApiError ? e.message : 'Could not load a puzzle.'));
  }, []);

  useEffect(() => {
    load();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [load]);

  const boardFen = useMemo(
    () => (puzzle ? applyLine(puzzle.fen, applied) : ''),
    [puzzle, applied],
  );

  const submit = useCallback(
    (wasSolved: boolean, outcome: AttemptOutcome, movesPlayed: string[]) => {
      if (!puzzle || submitted) return;
      setSubmitted(true);
      api
        .attemptPuzzle(puzzle.id, {
          solved: wasSolved,
          outcome,
          timeMs: Date.now() - startRef.current,
          hintsUsed: hintLevel,
          movesPlayed,
        })
        .catch((e) => console.warn('[puzzles] attempt post failed:', e));
    },
    [puzzle, submitted, hintLevel],
  );

  const outcome = (): AttemptOutcome => (hintLevel === 0 ? 'independent' : 'hinted');

  const handleMove = (from: string, to: string, promotion?: string): boolean => {
    if (!puzzle || solved || failed) return false;
    const playedUci = `${from}${to}${promotion ?? ''}`.toLowerCase();
    const expected = puzzle.solutionUci[applied.length]?.toLowerCase();
    // Validate legality first.
    try {
      const g = new Chess(boardFen);
      const { from: f, to: t, promotion: pr } = uciParts(playedUci);
      g.move({ from: f, to: t, promotion: pr });
    } catch {
      return false;
    }
    if (playedUci !== expected) {
      setFailed(true);
      submit(false, outcome(), [playedUci]);
      return true; // accept the move visually, then reveal
    }
    const next = [...applied, puzzle.solutionUci[applied.length]];
    setApplied(next);
    if (next.length >= puzzle.solutionUci.length) {
      setSolved(true);
      submit(true, outcome(), next);
    } else {
      // Opponent auto-reply after a beat.
      const opp = puzzle.solutionUci[next.length];
      timerRef.current = setTimeout(() => {
        setApplied((a) => {
          const withOpp = [...a, opp];
          if (withOpp.length >= (puzzle?.solutionUci.length ?? 0)) {
            setSolved(true);
            submit(true, outcome(), withOpp);
          }
          return withOpp;
        });
      }, 650);
    }
    return true;
  };

  const showSolution = () => {
    if (!puzzle) return;
    setFailed(true);
    setApplied(puzzle.solutionUci);
    submit(false, 'shown', puzzle.solutionUci);
  };

  if (error) return <div className="p-4"><ErrorBox message={error} onRetry={load} /></div>;
  if (!puzzle) return <div className="p-4"><Loading label="Finding a puzzle for you" /></div>;

  const done = solved || failed;

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <SectionTitle>Puzzles</SectionTitle>
        <span className="text-xs text-slate-500">
          rating {puzzle.rating} · {puzzle.themes.slice(0, 2).join(', ')}
        </span>
      </div>

      <Card>
        <p className="text-slate-200 text-[15px] mb-3">
          {solved ? 'Solved. Well played.' : failed ? 'Not quite — here is the idea.' : 'Find the best continuation.'}
        </p>
        <div className="flex justify-center mb-3">
          <ChessboardView
            id="puzzle-board"
            fen={boardFen}
            onMove={handleMove}
            allowMoves={!done}
            dimmed={done}
          />
        </div>

        {!done && (
          <div className="flex gap-2 flex-wrap">
            <Btn variant="subtle" onClick={() => setHintLevel((h) => Math.min(3, h + 1))} disabled={hintLevel >= 3}>
              {hintLevel === 0 ? 'Hint' : `Hint ${hintLevel}/3 — stronger`}
            </Btn>
            <Btn variant="subtle" onClick={showSolution}>
              Show solution
            </Btn>
          </div>
        )}

        {hintLevel > 0 && !done && (
          <div className="mt-3 space-y-2">
            {puzzle.hints.slice(0, hintLevel).map((h, i) => (
              <p key={i} className="text-sm text-amber-200/90 bg-amber-950/40 border border-amber-900/60 rounded-lg p-2">
                <span className="font-medium">Hint {i + 1}:</span> {h}
              </p>
            ))}
          </div>
        )}

        {done && (
          <div className="mt-3 space-y-3">
            <p className={`font-medium ${solved ? 'text-emerald-300' : 'text-red-300'}`}>
              {solved ? (hintLevel === 0 ? 'Solved independently.' : 'Solved with hints.') : 'Puzzle missed.'}
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">{puzzle.explanation}</p>
            <Btn onClick={load} className="w-full">
              Next puzzle
            </Btn>
          </div>
        )}
      </Card>
    </div>
  );
}

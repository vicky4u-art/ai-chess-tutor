/**
 * useChessGame — chess.js-backed game state with view navigation.
 *
 * Owns the live position, move application, undo/reset, FEN/PGN
 * import/export and a read-only "view ply" for stepping through history.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { Chess, Move, Square } from 'chess.js';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface GameStatus {
  turn: 'w' | 'b';
  inCheck: boolean;
  checkmate: boolean;
  stalemate: boolean;
  draw: boolean;
  gameOver: boolean;
  /** Human-readable result when the game is over, e.g. "1-0", "1/2-1/2". */
  result: string | null;
}

/** Split a UCI string ("e2e4", "e7e8q") into from/to/promotion parts. */
export function uciParts(uci: string): { from: string; to: string; promotion?: string } {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  };
}

/** Apply a UCI move to a Chess instance; returns the Move or null. */
export function applyUci(game: Chess, uci: string): Move | null {
  const { from, to, promotion } = uciParts(uci);
  try {
    return game.move({ from, to, promotion });
  } catch {
    return null;
  }
}

function statusOf(game: Chess): GameStatus {
  const checkmate = game.isCheckmate();
  const stalemate = game.isStalemate();
  const draw = game.isDraw();
  const gameOver = game.isGameOver();
  let result: string | null = null;
  if (checkmate) result = game.turn() === 'w' ? '0-1' : '1-0';
  else if (gameOver) result = '1/2-1/2';
  return {
    turn: game.turn(),
    inCheck: game.isCheck(),
    checkmate,
    stalemate,
    draw,
    gameOver,
    result,
  };
}

export function useChessGame(initialFen: string = START_FEN) {
  const gameRef = useRef<Chess | null>(null);
  if (!gameRef.current) {
    try {
      gameRef.current = new Chess(initialFen);
    } catch {
      gameRef.current = new Chess();
    }
  }
  const [startFen, setStartFen] = useState<string>(() => gameRef.current!.fen());
  const [fen, setFen] = useState<string>(() => gameRef.current!.fen());
  const [history, setHistory] = useState<Move[]>(() => gameRef.current!.history({ verbose: true }));
  // viewPly === null means "live" (latest). Otherwise an index into history
  // (0 = start position, history.length = latest).
  const [viewPly, setViewPly] = useState<number | null>(null);
  const [status, setStatus] = useState<GameStatus>(() => statusOf(gameRef.current!));

  const sync = useCallback(() => {
    const g = gameRef.current!;
    setFen(g.fen());
    setHistory(g.history({ verbose: true }));
    setStatus(statusOf(g));
    setViewPly(null);
  }, []);

  /** Attempt a move; returns true when legal and applied. */
  const move = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      const g = gameRef.current!;
      try {
        g.move({ from, to, promotion });
      } catch {
        return false;
      }
      sync();
      return true;
    },
    [sync],
  );

  const moveUci = useCallback(
    (uci: string): boolean => {
      const { from, to, promotion } = uciParts(uci);
      return move(from, to, promotion);
    },
    [move],
  );

  const undo = useCallback(() => {
    const g = gameRef.current!;
    if (g.history().length === 0) return false;
    g.undo();
    sync();
    return true;
  }, [sync]);

  const reset = useCallback(() => {
    const g = gameRef.current!;
    g.reset();
    setStartFen(g.fen());
    sync();
  }, [sync]);

  const loadFen = useCallback(
    (f: string): boolean => {
      const g = gameRef.current!;
      try {
        g.load(f);
      } catch {
        return false;
      }
      setStartFen(g.fen());
      sync();
      return true;
    },
    [sync],
  );

  const loadPgn = useCallback(
    (pgn: string): boolean => {
      const g = gameRef.current!;
      try {
        g.loadPgn(pgn);
      } catch {
        return false;
      }
      setStartFen(g.history({ verbose: true })[0]?.before ?? g.fen());
      sync();
      return true;
    },
    [sync],
  );

  const exportFen = useCallback(() => gameRef.current!.fen(), []);
  const exportPgn = useCallback(() => gameRef.current!.pgn(), []);

  const gotoPly = useCallback((ply: number) => {
    const len = gameRef.current!.history().length;
    const clamped = Math.max(0, Math.min(len, ply));
    setViewPly(clamped === len ? null : clamped);
  }, []);
  const stepBack = useCallback(() => {
    const len = gameRef.current!.history().length;
    setViewPly((v) => {
      const cur = v === null ? len : v;
      const next = Math.max(0, cur - 1);
      return next === len ? null : next;
    });
  }, []);
  const stepForward = useCallback(() => {
    const len = gameRef.current!.history().length;
    setViewPly((v) => {
      if (v === null) return null;
      const next = Math.min(len, v + 1);
      return next === len ? null : next;
    });
  }, []);
  const gotoStart = useCallback(() => setViewPly((v) => (v === 0 ? 0 : 0)), []);
  const gotoEnd = useCallback(() => setViewPly(null), []);

  /** Legal verbose moves from a square in the LIVE position. */
  const legalMovesFrom = useCallback((square: string): Move[] => {
    try {
      return gameRef.current!.moves({ square: square as Square, verbose: true });
    } catch {
      return [];
    }
  }, []);

  const isViewingHistory = viewPly !== null;

  const displayFen = useMemo(() => {
    if (viewPly === null) return fen;
    if (viewPly === 0) return startFen;
    return history[viewPly - 1]?.after ?? fen;
  }, [viewPly, fen, startFen, history]);

  const displayPly = viewPly === null ? history.length : viewPly;

  return {
    fen: displayFen,
    liveFen: fen,
    history,
    status,
    move,
    moveUci,
    undo,
    reset,
    loadFen,
    loadPgn,
    exportFen,
    exportPgn,
    gotoPly,
    gotoStart,
    gotoEnd,
    stepBack,
    stepForward,
    isViewingHistory,
    displayPly,
    legalMovesFrom,
  };
}

export type ChessGame = ReturnType<typeof useChessGame>;

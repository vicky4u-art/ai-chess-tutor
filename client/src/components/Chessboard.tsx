/**
 * Reusable chessboard built on react-chessboard + chess.js.
 *
 * - Drag-and-drop AND tap-to-move
 * - Legal-move dot highlighting (computed with chess.js from the `fen` prop)
 * - Premoves disabled
 * - Custom promotion picker overlay
 * - Arrows + square styles for teaching
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { Chessboard as RCB } from 'react-chessboard';
import { Chess, Square } from 'chess.js';

export interface Arrow {
  from: string;
  to: string;
  color?: string;
}

export interface ChessboardViewProps {
  fen: string;
  orientation?: 'white' | 'black';
  /** Return true when the move was accepted. */
  onMove?: (from: string, to: string, promotion?: string) => boolean;
  arrows?: Arrow[];
  squareStyles?: Record<string, React.CSSProperties>;
  allowMoves?: boolean;
  showCoordinates?: boolean;
  lastMove?: { from: string; to: string } | null;
  checkSquare?: string | null;
  id?: string;
  dimmed?: boolean;
}

const PROMO_PIECES = [
  { p: 'q', glyph: '♕' },
  { p: 'r', glyph: '♖' },
  { p: 'b', glyph: '♗' },
  { p: 'n', glyph: '♘' },
];

function sideToMove(fen: string): 'w' | 'b' {
  try {
    return new Chess(fen).turn();
  } catch {
    return 'w';
  }
}

export function ChessboardView({
  fen,
  orientation = 'white',
  onMove,
  arrows = [],
  squareStyles = {},
  allowMoves = true,
  showCoordinates = true,
  lastMove = null,
  checkSquare = null,
  id = 'board',
  dimmed = false,
}: ChessboardViewProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const gameRef = useRef<Chess | null>(null);

  const game = useMemo(() => {
    try {
      const g = new Chess(fen);
      gameRef.current = g;
      return g;
    } catch {
      return gameRef.current ?? new Chess();
    }
  }, [fen]);

  const turn = sideToMove(fen);

  const legalTargets = useCallback(
    (sq: string): string[] => {
      try {
        return game.moves({ square: sq as Square, verbose: true }).map((m) => m.to);
      } catch {
        return [];
      }
    },
    [game],
  );

  const isPromotion = useCallback((from: string, to: string): boolean => {
    const piece = game.get(from as Square);
    if (!piece || piece.type !== 'p') return false;
    return (piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1');
  }, [game]);

  const commit = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      if (!onMove) return false;
      const ok = onMove(from, to, promotion);
      if (ok) setSelected(null);
      return ok;
    },
    [onMove],
  );

  const tryTapMove = useCallback(
    (from: string, to: string): boolean => {
      if (isPromotion(from, to)) {
        setPromo({ from, to });
        return true;
      }
      return commit(from, to);
    },
    [commit, isPromotion],
  );

  // --- drag & drop ---------------------------------------------------------
  const onPieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string): boolean => {
      if (!allowMoves) return false;
      if (sourceSquare === targetSquare) return false;
      if (isPromotion(sourceSquare, targetSquare)) {
        setPromo({ from: sourceSquare, to: targetSquare });
        return false; // snap back; the overlay collects the promotion piece
      }
      return commit(sourceSquare, targetSquare);
    },
    [allowMoves, commit, isPromotion],
  );

  const isDraggablePiece = useCallback(
    ({ piece }: { piece: string; sourceSquare: string }) => {
      if (!allowMoves) return false;
      return piece[0].toLowerCase() === turn;
    },
    [allowMoves, turn],
  );

  const onPieceDragBegin = useCallback(
    (_piece: string, sourceSquare: string) => {
      setSelected(sourceSquare);
    },
    [],
  );

  // --- tap to move ----------------------------------------------------------
  const onSquareClick = useCallback(
    (square: string) => {
      if (!allowMoves || promo) return;
      const piece = game.get(square as Square);
      if (selected) {
        const targets = legalTargets(selected);
        if (targets.includes(square)) {
          tryTapMove(selected, square);
          return;
        }
      }
      if (piece && piece.color === turn) {
        setSelected(selected === square ? null : square);
      } else {
        setSelected(null);
      }
    },
    [allowMoves, promo, game, selected, legalTargets, tryTapMove, turn],
  );

  const promoColor: 'w' | 'b' = turn;

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = { ...squareStyles };
    if (lastMove) {
      const hl = { background: 'rgba(250, 204, 21, 0.35)' };
      styles[lastMove.from] = { ...(styles[lastMove.from] ?? {}), ...hl };
      styles[lastMove.to] = { ...(styles[lastMove.to] ?? {}), ...hl };
    }
    if (checkSquare) {
      styles[checkSquare] = {
        ...(styles[checkSquare] ?? {}),
        background: 'radial-gradient(circle, rgba(220,38,38,0.85) 18%, rgba(220,38,38,0.35) 60%, transparent 70%)',
      };
    }
    if (selected) {
      styles[selected] = { ...(styles[selected] ?? {}), background: 'rgba(250, 204, 21, 0.45)' };
      for (const t of legalTargets(selected)) {
        const targetPiece = game.get(t as Square);
        styles[t] = {
          ...(styles[t] ?? {}),
          background: targetPiece
            ? 'radial-gradient(circle, transparent 62%, rgba(34,197,94,0.65) 63%)'
            : 'radial-gradient(circle, rgba(34,197,94,0.55) 22%, transparent 24%)',
        };
      }
    }
    return styles;
  }, [squareStyles, lastMove, checkSquare, selected, legalTargets, game]);

  const rcbArrows = useMemo(
    () =>
      arrows.map(
        (a) => [a.from as Square, a.to as Square, a.color ?? 'rgba(34,197,94,0.9)'] as [Square, Square, string],
      ),
    [arrows],
  );

  return (
    <div className="relative" style={{ width: 'min(92vw, 480px)' }}>
      <RCB
        id={id}
        position={fen}
        boardOrientation={orientation}
        onPieceDrop={onPieceDrop}
        onSquareClick={onSquareClick}
        onPieceDragBegin={onPieceDragBegin}
        isDraggablePiece={isDraggablePiece}
        arePremovesAllowed={false}
        areArrowsAllowed={false}
        customArrows={rcbArrows}
        customSquareStyles={customSquareStyles}
        showBoardNotation={showCoordinates}
        animationDuration={200}
        customBoardStyle={{ borderRadius: '8px', opacity: dimmed ? 0.55 : 1 }}
        customDarkSquareStyle={{ backgroundColor: '#7a5c3e' }}
        customLightSquareStyle={{ backgroundColor: '#e8d0a9' }}
      />
      {promo && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 rounded-lg">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
            <p className="text-slate-200 text-sm mb-3 text-center">Promote to</p>
            <div className="flex gap-2">
              {PROMO_PIECES.map(({ p, glyph }) => (
                <button
                  key={p}
                  onClick={() => {
                    commit(promo.from, promo.to, p);
                    setPromo(null);
                  }}
                  className="w-14 h-14 text-4xl rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100"
                  style={{ color: promoColor === 'w' ? '#f8fafc' : '#0f172a', textShadow: promoColor === 'w' ? '0 0 2px #000' : 'none' }}
                  aria-label={`Promote to ${p === 'q' ? 'queen' : p === 'r' ? 'rook' : p === 'b' ? 'bishop' : 'knight'}`}
                >
                  {glyph}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPromo(null)}
              className="mt-3 w-full text-sm text-slate-400 hover:text-slate-200 min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

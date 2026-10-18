/** chess.js-backed validation helpers. The engine of truth for move legality. */
import { Chess, Move } from 'chess.js';

/** True if every UCI move in the sequence is legal from the FEN, in order. */
export function isLegalSequence(fen: string, ucis: string[]): boolean {
  try {
    const chess = new Chess(fen);
    for (const uci of ucis) {
      const mv = chess.move(uciToMove(uci));
      if (!mv) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Apply a UCI sequence; returns final FEN or null if any move is illegal. */
export function applySequence(fen: string, ucis: string[]): string | null {
  try {
    const chess = new Chess(fen);
    for (const uci of ucis) {
      if (!chess.move(uciToMove(uci))) return null;
    }
    return chess.fen();
  } catch {
    return null;
  }
}

/** Extract candidate UCI move tokens from free text. */
export function extractUciMoves(text: string): string[] {
  const matches = text.match(/\b[a-h][1-8][a-h][1-8][qrbn]?\b/g) ?? [];
  return [...new Set(matches)];
}

/** Keep only the moves that are legal from the FEN (checked in isolation). */
export function validatedMoves(fen: string, candidates: string[]): string[] {
  const out: string[] = [];
  try {
    for (const uci of candidates) {
      const chess = new Chess(fen);
      if (chess.move(uciToMove(uci))) out.push(uci);
    }
  } catch {
    // fall through with what we have
  }
  return out;
}

/** Parse a PGN into {sans, ucis, fens}. Throws on invalid PGN. */
export function parsePgn(pgn: string): { sans: string[]; ucis: string[]; fensBefore: string[]; result: string } {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const history = chess.history({ verbose: true });
  const replay = new Chess();
  const ucis: string[] = [];
  const fensBefore: string[] = [];
  for (const mv of history) {
    fensBefore.push(replay.fen());
    ucis.push(mv.from + mv.to + (mv.promotion ?? ''));
    replay.move(mv.san);
  }
  const headers = chess.header();
  return { sans: history.map((m: Move) => m.san), ucis, fensBefore, result: headers['Result'] ?? '*' };
}

export function sideToMove(fen: string): 'w' | 'b' {
  return new Chess(fen).turn();
}

export function isCheckmate(fen: string): boolean {
  try {
    return new Chess(fen).isCheckmate();
  } catch {
    return false;
  }
}

/** Material balance from White's perspective (P=1,N=3,B=3,R=5,Q=9). */
export function materialBalance(fen: string): number {
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let score = 0;
  for (const row of fen.split(' ')[0].split('/')) {
    for (const ch of row) {
      if (/[1-8]/.test(ch)) continue;
      const v = values[ch.toLowerCase()] ?? 0;
      score += ch === ch.toUpperCase() ? v : -v;
    }
  }
  return score;
}

function uciToMove(uci: string): { from: string; to: string; promotion?: string } {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  };
}

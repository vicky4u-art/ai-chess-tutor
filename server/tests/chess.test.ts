import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  isLegalSequence, applySequence, extractUciMoves, validatedMoves,
  parsePgn, isCheckmate, materialBalance,
} from '../src/chess.js';

describe('move legality', () => {
  const start = new Chess().fen();
  it('accepts legal sequences', () => {
    expect(isLegalSequence(start, ['e2e4', 'e7e5', 'g1f3'])).toBe(true);
  });
  it('rejects illegal moves', () => {
    expect(isLegalSequence(start, ['e2e5'])).toBe(false);
    expect(isLegalSequence(start, ['e2e4', 'e7e5', 'e4e6'])).toBe(false);
  });
  it('handles castling', () => {
    // Ruy Lopez-ish line where both sides castle
    expect(isLegalSequence(start, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'e1g1', 'f8e7', 'f1e1', 'e8g8'])).toBe(true);
  });
  it('handles en passant', () => {
    const fen = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3';
    expect(isLegalSequence(fen, ['e5d6'])).toBe(true);
    expect(applySequence(fen, ['e5d6'])?.split(' ')[0]).toBe('rnbqkbnr/ppp1pppp/3P4/8/8/8/PPPP1PPP/RNBQKBNR');
  });
  it('handles promotion', () => {
    const fen = '8/2P5/8/8/8/1k6/8/4K3 w - - 0 1';
    expect(isLegalSequence(fen, ['c7c8q'])).toBe(true);
    expect(isLegalSequence(fen, ['c7c8'])).toBe(false); // promotion piece required
  });
  it('detects checkmate and stalemate', () => {
    // Fool's mate: 1.f3 e5 2.g4 Qh4#
    expect(isCheckmate('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 0 3')).toBe(true);
    expect(isCheckmate(new Chess().fen())).toBe(false);
    // Stalemate: black king a8, no legal moves, not in check
    const stalemate = new Chess('k7/8/1Q6/8/8/8/8/7K b - - 0 1');
    expect(stalemate.isStalemate()).toBe(true);
    expect(stalemate.isCheckmate()).toBe(false);
  });
});

describe('FEN / PGN', () => {
  it('round-trips a short game', () => {
    const pgn = '[White "A"]\n[Black "B"]\n[Result "1-0"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0';
    const parsed = parsePgn(pgn);
    expect(parsed.sans).toEqual(['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#']);
    expect(parsed.ucis[6]).toBe('h5f7');
    expect(parsed.result).toBe('1-0');
    expect(isCheckmate(applySequence(new Chess().fen(), parsed.ucis)!)).toBe(true);
  });
  it('rejects garbage PGN', () => {
    expect(() => parsePgn('this is not a game')).toThrow();
  });
});

describe('move extraction / validation', () => {
  it('extracts UCI tokens from text', () => {
    expect(extractUciMoves('Try e2e4 or maybe g1f3!')).toEqual(['e2e4', 'g1f3']);
  });
  it('keeps only legal moves', () => {
    const start = new Chess().fen();
    expect(validatedMoves(start, ['e2e4', 'e2e5', 'a1a9'])).toEqual(['e2e4']);
  });
});

describe('materialBalance', () => {
  it('scores the start position as equal', () => {
    expect(materialBalance(new Chess().fen())).toBe(0);
  });
  it('counts a queen as 9', () => {
    expect(materialBalance('4k3/8/8/8/8/8/8/4K2Q w - - 0 1')).toBe(9);
  });
});

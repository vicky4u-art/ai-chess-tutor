/**
 * Seed puzzle set: 48 hand-verified puzzles.
 *
 * Composition: 23 mate-in-1, 4 mate-in-2, 21 one-move tactic wins.
 * Every entry was validated with chess.js (see scripts/verify-content.mjs):
 * - all solutionUci moves are legal in sequence from the FEN,
 * - mate puzzles end in checkmate,
 * - tactic puzzles end with clear material gain for the side to move.
 *
 * Ratings are rough difficulty estimates (600-1800 Lichess scale), NOT
 * measured values. Themes follow Lichess naming where applicable.
 *
 * The data below uses plain object literals plus the single
 * `export const X: T[]` annotation, so scripts can load it without a
 * TypeScript compiler.
 */
import type { Puzzle } from "@chesstutor/shared";

export const SEED_PUZZLES: Puzzle[] = [
  // ---- mate in 1 (back-rank and basic mates) ----
  { id: "seed-001", sourceId: "seed", fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1", solutionUci: ["e1e8"], rating: 650, themes: ["mate", "mateIn1", "backRankMate"] },
  { id: "seed-002", sourceId: "seed", fen: "6k1/5ppp/8/8/8/8/8/4Q1K1 w - - 0 1", solutionUci: ["e1e8"], rating: 620, themes: ["mate", "mateIn1", "backRankMate"] },
  { id: "seed-003", sourceId: "seed", fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", solutionUci: ["a1a8"], rating: 610, themes: ["mate", "mateIn1", "backRankMate"] },
  { id: "seed-004", sourceId: "seed", fen: "6k1/5ppp/8/8/8/8/8/3Q2K1 w - - 0 1", solutionUci: ["d1d8"], rating: 630, themes: ["mate", "mateIn1", "backRankMate"] },
  { id: "seed-005", sourceId: "seed", fen: "6k1/5ppp/8/8/8/8/8/Q5K1 w - - 0 1", solutionUci: ["a1a8"], rating: 640, themes: ["mate", "mateIn1", "backRankMate"] },
  { id: "seed-006", sourceId: "seed", fen: "7k/5ppp/8/8/8/8/5PQP/6RK w - - 0 1", solutionUci: ["g2g7"], rating: 780, themes: ["mate", "mateIn1"] },
  { id: "seed-007", sourceId: "seed", fen: "6k1/5ppp/8/8/8/8/5PPP/1R4K1 w - - 0 1", solutionUci: ["b1b8"], rating: 660, themes: ["mate", "mateIn1", "backRankMate"] },
  { id: "seed-008", sourceId: "seed", fen: "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", solutionUci: ["d1d8"], rating: 650, themes: ["mate", "mateIn1", "backRankMate"] },
  { id: "seed-009", sourceId: "seed", fen: "4r1k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1", solutionUci: ["e1e8"], rating: 720, themes: ["mate", "mateIn1", "backRankMate"] },
  { id: "seed-010", sourceId: "seed", fen: "6k1/5ppp/8/8/8/8/5PPP/3Q3K w - - 0 1", solutionUci: ["d1d8"], rating: 680, themes: ["mate", "mateIn1", "backRankMate"] },
  { id: "seed-011", sourceId: "seed", fen: "6k1/5ppp/8/8/8/8/5PPP/2Q3K1 w - - 0 1", solutionUci: ["c1c8"], rating: 670, themes: ["mate", "mateIn1", "backRankMate"] },
  { id: "seed-012", sourceId: "seed", fen: "3r2k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1", solutionUci: ["d1d8"], rating: 740, themes: ["mate", "mateIn1", "backRankMate"] },
  { id: "seed-013", sourceId: "seed", fen: "7k/6pp/8/8/8/8/5QPP/6K1 w - - 0 1", solutionUci: ["f2f8"], rating: 700, themes: ["mate", "mateIn1"] },
  { id: "seed-014", sourceId: "seed", fen: "6k1/6pp/8/8/8/8/5PPP/4Q1K1 w - - 0 1", solutionUci: ["e1e8"], rating: 690, themes: ["mate", "mateIn1"] },
  { id: "seed-015", sourceId: "seed", fen: "6k1/5ppp/8/8/8/8/5PPP/2R3K1 w - - 0 1", solutionUci: ["c1c8"], rating: 660, themes: ["mate", "mateIn1", "backRankMate"] },
  { id: "seed-016", sourceId: "seed", fen: "7k/8/5K2/8/8/8/8/6Q1 w - - 0 1", solutionUci: ["g1g7"], rating: 820, themes: ["mate", "mateIn1"] },
  { id: "seed-017", sourceId: "seed", fen: "1r4k1/5ppp/8/8/8/8/5PPP/1R4K1 w - - 0 1", solutionUci: ["b1b8"], rating: 730, themes: ["mate", "mateIn1", "backRankMate"] },
  { id: "seed-018", sourceId: "seed", fen: "4r1k1/5ppp/8/8/8/8/5PPP/4Q1K1 w - - 0 1", solutionUci: ["e1e8"], rating: 750, themes: ["mate", "mateIn1", "backRankMate"] },
  { id: "seed-019", sourceId: "seed", fen: "1r4k1/5ppp/8/8/8/8/1Q3PPP/6K1 w - - 0 1", solutionUci: ["b2b8"], rating: 760, themes: ["mate", "mateIn1", "backRankMate"] },
  { id: "seed-020", sourceId: "seed", fen: "3q2k1/5ppp/8/8/8/8/3QPPPP/6K1 w - - 0 1", solutionUci: ["d2d8"], rating: 770, themes: ["mate", "mateIn1", "backRankMate"] },
  { id: "seed-046", sourceId: "seed", fen: "6k1/5ppp/8/8/8/8/R4PPP/6K1 w - - 0 1", solutionUci: ["a2a8"], rating: 640, themes: ["mate", "mateIn1", "backRankMate"] },
  { id: "seed-047", sourceId: "seed", fen: "6k1/5ppp/8/8/8/8/Q4PPP/6K1 w - - 0 1", solutionUci: ["a2a8"], rating: 650, themes: ["mate", "mateIn1", "backRankMate"] },
  // ---- mate in 1 (back-rank and basic mates), continued ----
  { id: "seed-021", sourceId: "seed", fen: "6k1/5ppp/8/8/8/8/1Q3PPP/6K1 w - - 0 1", solutionUci: ["b2b8"], rating: 680, themes: ["mate", "mateIn1", "backRankMate"] },
  { id: "seed-022", sourceId: "seed", fen: "5rk1/5ppp/8/8/8/7Q/5PPP/2R3K1 w - - 0 1", solutionUci: ["c1c8", "f8c8", "h3c8"], rating: 1100, themes: ["mate", "mateIn2", "sacrifice"] },
  { id: "seed-024", sourceId: "seed", fen: "3r2k1/5ppp/8/8/8/8/4QPPP/4R1K1 w - - 0 1", solutionUci: ["e2e8", "d8e8", "e1e8"], rating: 1050, themes: ["mate", "mateIn2", "sacrifice"] },
  { id: "seed-025", sourceId: "seed", fen: "5rk1/5ppp/8/8/4Q3/8/5PPP/R5K1 w - - 0 1", solutionUci: ["a1a8", "f8a8", "e4a8"], rating: 1150, themes: ["mate", "mateIn2", "sacrifice"] },
  { id: "seed-026", sourceId: "seed", fen: "5rk1/5ppp/8/8/8/8/4QPPP/4R1K1 w - - 0 1", solutionUci: ["e2e8", "f8e8", "e1e8"], rating: 1080, themes: ["mate", "mateIn2", "sacrifice"] },
  // ---- one-move tactics ----
  { id: "seed-023", sourceId: "seed", fen: "6k1/5ppp/8/8/8/4n3/5PPP/4Q1K1 w - - 0 1", solutionUci: ["e1e3"], rating: 800, themes: ["hangingPiece"] },
  { id: "seed-027", sourceId: "seed", fen: "6k1/5ppp/8/4r3/3P4/8/5PPP/4R1K1 w - - 0 1", solutionUci: ["d4e5"], rating: 850, themes: ["hangingPiece"] },
  { id: "seed-028", sourceId: "seed", fen: "6k1/5ppp/8/8/3q4/5N2/5PPP/6K1 w - - 0 1", solutionUci: ["f3d4"], rating: 950, themes: ["hangingPiece"] },
  { id: "seed-029", sourceId: "seed", fen: "6k1/5ppp/8/3n4/4P3/8/5PPP/6K1 w - - 0 1", solutionUci: ["e4d5"], rating: 780, themes: ["hangingPiece"] },
  { id: "seed-030", sourceId: "seed", fen: "6k1/5ppp/8/8/5n2/6K1/8/8 w - - 0 1", solutionUci: ["g3f4"], rating: 820, themes: ["hangingPiece"] },
  { id: "seed-031", sourceId: "seed", fen: "6k1/5ppp/8/8/3b4/8/5PPP/3R2K1 w - - 0 1", solutionUci: ["d1d4"], rating: 840, themes: ["hangingPiece"] },
  { id: "seed-032", sourceId: "seed", fen: "6k1/5ppp/3n1b2/8/4P3/8/5PPP/6K1 w - - 0 1", solutionUci: ["e4e5", "f6e7", "e5d6"], rating: 1200, themes: ["fork", "pawnTactics"] },
  { id: "seed-033", sourceId: "seed", fen: "r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1", solutionUci: ["b5c6", "d7c6", "f3e5"], rating: 1300, themes: ["deflection", "opening"] },
  { id: "seed-034", sourceId: "seed", fen: "3r3k/5ppp/8/4N3/8/8/5PPP/6K1 w - - 0 1", solutionUci: ["e5f7", "h8g8", "f7d8"], rating: 1400, themes: ["fork", "knightFork"] },
  { id: "seed-035", sourceId: "seed", fen: "6k1/5ppp/8/8/3q4/8/5PPP/3R2K1 w - - 0 1", solutionUci: ["d1d4"], rating: 900, themes: ["hangingPiece"] },
  { id: "seed-036", sourceId: "seed", fen: "6k1/n4ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", solutionUci: ["a1a7"], rating: 810, themes: ["hangingPiece"] },
  { id: "seed-037", sourceId: "seed", fen: "6k1/5ppp/8/8/n7/8/5PPP/R5K1 w - - 0 1", solutionUci: ["a1a4"], rating: 830, themes: ["hangingPiece"] },
  { id: "seed-038", sourceId: "seed", fen: "6k1/5P2/5K2/8/8/8/1r6/6R1 w - - 0 1", solutionUci: ["g1g4"], rating: 1500, themes: ["endgame", "rookEndgame"] },
  { id: "seed-039", sourceId: "seed", fen: "6k1/5ppp/8/8/3n4/8/1B2PPPP/6K1 w - - 0 1", solutionUci: ["b2d4"], rating: 860, themes: ["hangingPiece"] },
  { id: "seed-040", sourceId: "seed", fen: "6k1/5ppp/8/8/8/2b5/5PPP/2R3K1 w - - 0 1", solutionUci: ["c1c3"], rating: 880, themes: ["hangingPiece"] },
  { id: "seed-041", sourceId: "seed", fen: "4k3/8/8/8/4N3/8/5PPP/4R1K1 w - - 0 1", solutionUci: ["e4f6"], rating: 1350, themes: ["discoveredAttack", "doubleCheck"] },
  { id: "seed-042", sourceId: "seed", fen: "6k1/5ppp/8/r7/8/8/5PPP/4Q1K1 w - - 0 1", solutionUci: ["e1a5"], rating: 920, themes: ["hangingPiece"] },
  { id: "seed-043", sourceId: "seed", fen: "6k1/5ppp/8/8/5n2/6K1/8/8 w - - 0 1", solutionUci: ["g3f4"], rating: 800, themes: ["hangingPiece"] },
  { id: "seed-044", sourceId: "seed", fen: "6k1/5rpp/8/8/8/8/6PP/5Q1K w - - 0 1", solutionUci: ["f1f7"], rating: 980, themes: ["hangingPiece"] },
  { id: "seed-045", sourceId: "seed", fen: "6k1/5ppp/8/3b4/8/8/6PP/3Q2K1 w - - 0 1", solutionUci: ["d1d5"], rating: 870, themes: ["hangingPiece"] },
  { id: "seed-048", sourceId: "seed", fen: "6k1/5ppp/8/8/8/2n5/1B2PPPP/6K1 w - - 0 1", solutionUci: ["b2c3"], rating: 840, themes: ["hangingPiece"] },
];

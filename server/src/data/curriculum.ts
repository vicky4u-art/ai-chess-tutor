/**
 * Curriculum content: 15 lessons (one per concept) + 60 exercises (4 per lesson).
 *
 * Conventions used in this file:
 * - `solutionUci` for 'find-move' / 'choose-move' is a list of UCI strings
 *   (usually one move; a few exercises use short forcing sequences).
 * - For 'yes-no' exercises, `solutionUci` is ["yes"] or ["no"] (a pseudo
 *   value, NOT a chess move). The client renders Yes/No buttons.
 * - `acceptableUci` lists alternative first-move sequences, each an array
 *   of UCI strings, e.g. [["b1c3"]] means b1c3 is also accepted.
 * - Every FEN and every solutionUci move was validated with chess.js
 *   (see scripts/verify-content.mjs). Mate exercises end in checkmate.
 *
 * The data below uses plain object literals plus the two `export const X: T[]`
 * annotations only, so scripts can load it without a TypeScript compiler.
 */
import type { Exercise, Lesson } from "@chesstutor/shared";

export const LESSONS: Lesson[] = [
  {
    id: "lesson-rules-checkmates",
    conceptId: "rules-checkmates",
    level: 1,
    title: "How the Pieces Move & Mating on the Back Rank",
    objective: "Move every piece correctly and deliver checkmate against a trapped king on the back rank.",
    exerciseIds: ["ex-rules-1", "ex-rules-2", "ex-rules-3", "ex-rules-4"],
    contentMd: [
      "Every chess game ends the same way: checkmate. The king is in check and has no legal move. You do not capture the king; the game stops one move before that. Stalemate is different: the side to move has no legal move but is NOT in check, and the game is an immediate draw. Beginners lose half-points to stalemate constantly, so learn the difference now.",
      "",
      "The most common beginner checkmate is the back-rank mate. When a king is trapped on the back rank by its own pawns (typically on f7, g7, h7), a rook or queen delivering check along the back rank is mate, because the pawns block every escape square. Before playing for it, always ask: can the king step to f8 or h8, and is the mating square defended?",
      "",
      "Piece movement refresher: the rook slides along ranks and files; the bishop along diagonals; the queen does both. Knights jump in an L-shape (two squares one way, one the other) and are the only piece that can jump over others. Pawns move forward one square (two from their starting square) and capture one square diagonally forward. The king moves one square in any direction. Two special moves: castling (king moves two squares toward a rook, and the rook jumps over, only if neither has moved, the squares between are empty, and the king is not in check and does not pass through check) and en passant (a pawn capturing an adjacent pawn that just moved two squares, as if it had moved one).",
      "",
      "In the exercises, you will mate a trapped king and then identify a stalemate. Remember: checkmate wins, stalemate draws. When you are winning, always leave the enemy king at least one legal move until the mating blow lands.",
    ].join("\n"),
  },
  {
    id: "lesson-development",
    conceptId: "development",
    level: 1,
    title: "Develop Your Pieces",
    objective: "Bring knights and bishops into play quickly instead of moving the same piece repeatedly or bringing the queen out early.",
    exerciseIds: ["ex-dev-1", "ex-dev-2", "ex-dev-3", "ex-dev-4"],
    contentMd: [
      "Development means moving your pieces from their starting squares to active squares where they control the center and are ready for the middlegame. Knights belong on c3, f3, c6, f6 (and later d4, e4, d5, e5). Bishops belong on open diagonals like c4, b5, c5, b4. Each tempo matters: moving the same piece twice while the rest of your army sleeps hands your opponent a lead in development.",
      "",
      "Three opening sins to avoid. First, bringing the queen out early: the queen is your most valuable piece, and early queen moves invite the opponent to develop with tempo by attacking it (1. e4 e5 2. Qh5?! Nc6 develops a piece while gaining time on your queen). Second, moving a piece twice before all your pieces have moved once. Third, grabbing pawns while your king sits in the center.",
      "",
      "A practical rule: in the first ten moves, aim to move each minor piece once, castle, and connect your rooks. Do not start an attack until your king is safe and your pieces are out. The exercises ask you to choose developing moves and to spot the classic mistake of an early queen sortie.",
      "",
      "Development is not just speed; it is harmony. Pieces should defend each other and point toward the center. A knight on c3, a bishop on c4, a pawn on e4, and a castled king is a complete, healthy opening setup. Learn to recognize that picture.",
    ].join("\n"),
  },
  {
    id: "lesson-center",
    conceptId: "center",
    level: 1,
    title: "Fight for the Center",
    objective: "Occupy and contest the central squares (e4, d4, e5, d5) with pawns and pieces.",
    exerciseIds: ["ex-cen-1", "ex-cen-2", "ex-cen-3", "ex-cen-4"],
    contentMd: [
      "The center is the most important real estate on the board. Pawns and pieces placed in the center control the most squares, give your pieces maximum mobility, and provide a springboard for attacks on either wing. The classical ideal is two pawns abreast on d4 and e4 (or d5 and e5 for Black), supported by knights on c3/f3 and bishops on open diagonals.",
      "",
      "There are three ways to fight for the center: occupy it with your pawns (1. e4, 1. d4), attack it with your pieces (knights on f3 and c3 pressure e5 and d5), and challenge it by capturing or pushing against the opponent's central pawns (d4 in response to ...e5, or ...d5 against e4). When you capture toward the center (exd5 rather than ...exd5 away from it), your pawn lands on a central square and your pieces gain scope.",
      "",
      "A common beginner error is pushing flank pawns (like a4 or h4) while the center is still fluid. Flank moves do not fight for the key squares and often just weaken your own king. Another is allowing the opponent to build an unchallenged pawn center: if Black plays ...e5 and ...d5 without resistance, White's pieces will suffocate.",
      "",
      "In the exercises you will seize central space with pawn pushes, challenge the enemy center, and capture toward the middle. Ask of every opening move: does this help me control d4, d5, e4, or e5?",
    ].join("\n"),
  },
  {
    id: "lesson-king-safety",
    conceptId: "king-safety",
    level: 1,
    title: "Keep Your King Safe",
    objective: "Castle early, keep the pawn shelter intact, and recognize when the king is in danger.",
    exerciseIds: ["ex-ks-1", "ex-ks-2", "ex-ks-3", "ex-ks-4"],
    contentMd: [
      "The king is the one piece you cannot afford to lose, and in the opening it is a liability, not a fighter. Castle early, usually within the first ten moves. Castling does two jobs at once: it tucks the king behind a wall of pawns on the wing and it brings a rook toward the center. A king stuck in the middle when the center opens is the single most common cause of fast beginner losses.",
      "",
      "After castling, treat the three pawns in front of your king (f2, g2, h2) as a shelter, not as attackers. Every pawn push in front of your castled king opens lines toward it. Push f4 or g4 only when you have a concrete reason, because weakened dark or light squares around the king invite sacrifices and mating nets.",
      "",
      "Learn to sense danger: an open file or diagonal pointing at your king, an enemy queen and bishop aimed at your kingside, or your opponent castling on the opposite wing (a signal of a coming pawn storm). When you see these signs, slow down, keep pieces near the king, and avoid further weakening pawn moves.",
      "",
      "The exercises drill the habit: castle when you can, prefer the safe developing move over the flashy pawn grab, and judge whether an early enemy foray is a real threat or just noise. A safe king is the foundation every plan is built on.",
    ].join("\n"),
  },
  {
    id: "lesson-hanging-pieces",
    conceptId: "hanging-pieces",
    level: 1,
    title: "Hanging Pieces & the Blunder Check",
    objective: "Spot undefended enemy pieces you can win, and run a blunder check before every move so you stop hanging your own.",
    exerciseIds: ["ex-hp-1", "ex-hp-2", "ex-hp-3", "ex-hp-4"],
    contentMd: [
      "A hanging piece is undefended: if you capture it, the opponent cannot recapture with equal value. Most games below intermediate level are decided by hanging pieces, not by brilliant combinations. Train your eyes to scan every move: which enemy pieces have no defender? Rooks left on open files, knights that wandered too far, queens that got greedy.",
      "",
      "Winning a hanging piece is simple arithmetic. A pawn attacks diagonally, so a pawn on d4 attacks both c5 and e5. Before capturing, always verify the defender count: is the piece truly undefended, or does a recapture win it back? Also check that YOUR capturing piece is not pinned and that the capture does not walk into a tactic.",
      "",
      "Defense is the mirror skill. Before you touch a piece, run the blunder check: (1) Am I leaving a piece undefended? (2) Does my move allow a check, a capture, or a threat I have not seen? (3) What is my opponent's most forcing reply? This thirty-second habit will save more points than any opening preparation.",
      "",
      "In the exercises you will win hanging rooks, queens, and minor pieces, and you will judge whether a pawn is truly en prise. Make the blunder check automatic: threats first, then your idea.",
    ].join("\n"),
  },
  {
    id: "lesson-tactics",
    conceptId: "tactics",
    level: 1,
    title: "Tactical Patterns: Forks, Pins, Skewers",
    objective: "Recognize and execute forks, pins, skewers, and discovered attacks.",
    exerciseIds: ["ex-tac-1", "ex-tac-2", "ex-tac-3", "ex-tac-4"],
    contentMd: [
      "Tactics are forcing sequences that win material or deliver mate. Four patterns cover the vast majority of what you will see. A fork is one piece attacking two or more enemy pieces at once; knights are the classic forking piece because their jump is hard to predict (Nf7+ forking king and rook is the model). A pin freezes a piece in place because moving it would expose something more valuable behind it (Bb5 pinning a knight to the king).",
      "",
      "A skewer is a pin in reverse: you attack the more valuable piece first, and when it moves, you win the piece behind it. A discovered attack moves one piece out of the way so another piece's line opens with tempo, often with check. The most violent version is the double check, where two pieces give check at once and the king must move.",
      "",
      "Pattern recognition comes from repetition, not from memorizing definitions. When you see a loose king and an unprotected rook, your hand should start looking for knight checks. When you see pieces lined up on a file, diagonal, or rank, ask what happens if the front piece moves.",
      "",
      "The exercises build the three most useful patterns: the pin (Bb5), the knight fork (Nf7+), and the discovered double check. For each, first identify WHAT is attacked, then verify the move is legal and the tactic actually wins.",
    ].join("\n"),
  },
  {
    id: "lesson-calculation",
    conceptId: "calculation",
    level: 1,
    title: "Calculation: See It Through to the End",
    objective: "Calculate short forcing sequences completely before playing them, verifying every reply.",
    exerciseIds: ["ex-cal-1", "ex-cal-2", "ex-cal-3", "ex-cal-4"],
    contentMd: [
      "Calculation is the discipline of seeing a sequence through to its end before committing. Beginners usually calculate their own brilliant move and stop; strong players calculate the opponent's replies too. The method: (1) list candidate moves, (2) for each, find the opponent's most forcing replies (checks, captures, threats), (3) follow the critical line to a quiescent position you can evaluate, (4) only then decide.",
      "",
      "Start with forcing moves, because they narrow the tree. Checks, captures, and direct threats demand specific answers, so a combination beginning with a sacrifice is often easier to calculate than a quiet positional sequence. The classic back-rank sacrifice (Qe8+, forcing Rxe8, then mating on e8) works because Black has exactly one legal reply at each step.",
      "",
      "Visualization is the supporting skill: holding the board in your head two or three moves deep. Practice by calculating without moving the pieces, then checking. When you err, notice WHERE the visualization broke: did you forget a piece, misjudge a check, or stop one move early?",
      "",
      "In the exercises you will find forcing first moves, compute a two-move pawn win (Bxc6 removing the defender, then Nxe5), and verify a mate to the very end. Never play a sacrifice on hope; play it on calculation.",
    ].join("\n"),
  },
  {
    id: "lesson-openings",
    conceptId: "openings",
    level: 1,
    title: "Opening Principles, Not Memorization",
    objective: "Play the first moves by principle: develop, fight for the center, castle, and punish early mistakes.",
    exerciseIds: ["ex-op-1", "ex-op-2", "ex-op-3", "ex-op-4"],
    contentMd: [
      "You do not need opening theory; you need opening principles. (1) Develop knights before bishops, and bishops before the queen. (2) Fight for the center with pawns and pieces. (3) Castle early. (4) Do not move the same piece twice. (5) Do not bring the queen out early. Follow these five rules and you will reach a playable middlegame against anyone below expert level.",
      "",
      "Two setups are worth knowing by heart. As White: 1. e4 e5 2. Nf3 Nc6 3. Bc4 (the Italian Game) develops with threats, controls the center, and prepares castling. As Black against 1. d4: 1...Nf6 or 1...d5, developing and contesting the center. These are not traps; they are healthy, principled positions from which you can outplay opponents.",
      "",
      "When the opponent breaks principles, punish simply. After 1. e4 e5 2. Qh5?!, do not panic and do not grab: develop with ...Nc6 (and ...Nf6 is a known blunder walking into Qxe5+ ideas). The refutation of an early queen is development with tempo, not cleverness.",
      "",
      "The exercises test principle over memory: choose the developing move, answer 1. d4 correctly, meet the premature queen sortie, and recognize the Ruy Lopez (3. Bb5) as the most principled alternative to the Italian. Principles travel; memorized lines do not.",
    ].join("\n"),
  },
  {
    id: "lesson-activity",
    conceptId: "activity",
    level: 1,
    title: "Piece Activity: Put Every Piece to Work",
    objective: "Place rooks on open files and the seventh rank, centralize knights, and activate bishops on open diagonals.",
    exerciseIds: ["ex-act-1", "ex-act-2", "ex-act-3", "ex-act-4"],
    contentMd: [
      "An active piece controls many squares, attacks enemy weaknesses, and is ready to join an attack. A passive piece defends, retreats, and watches from the sidelines. Most positional advantage is just the sum of these differences: the player with more active pieces usually has the better position, even with equal material.",
      "",
      "Rooks are the simplest to activate: put them on open files (files with no pawns) and half-open files (files with only an enemy pawn), then lift them to the seventh rank, where they attack pawns and tie the enemy king down. A rook on the seventh is worth nearly a pawn more than the same rook on the first rank. Knights want central outposts, squares they cannot be chased from by enemy pawns (d5, e5, f5, c4). Bishops want long, unobstructed diagonals; a bishop biting on its own pawns is a tall pawn.",
      "",
      "The rim is dim: knights on a1, h1, a4, h4 control few squares and are easily sidelined. When a piece ends up badly placed, improving it is often the best plan in the position, better than starting a premature attack.",
      "",
      "In the exercises you will invade the seventh rank, choose the bishop's most active diagonal, and rescue a knight from the rim. After every few moves, ask: which of my pieces is worst placed, and where does it want to be?",
    ].join("\n"),
  },
  {
    id: "lesson-pawn-structure",
    conceptId: "pawn-structure",
    level: 1,
    title: "Pawn Structures: The Skeleton of the Position",
    objective: "Push passed pawns, damage the enemy structure, and play the thematic central breaks.",
    exerciseIds: ["ex-ps-1", "ex-ps-2", "ex-ps-3", "ex-ps-4"],
    contentMd: [
      "Pawns are the skeleton of the position: they cannot move backward, so every pawn move permanently shapes the board. Three structural ideas matter most. First, the passed pawn, which has no enemy pawn blocking or attacking it on its road to promotion; passed pawns must be pushed, because their value grows as they advance. Second, pawn breaks, pawn pushes (like d4-d5 or c4xd5) that challenge the center and open lines for your pieces at the right moment.",
      "",
      "Third, pawn weaknesses. Doubled pawns (two of your pawns on one file) are less mobile and harder to defend. Isolated pawns (no friendly pawn on adjacent files) must be defended by pieces, tying them down. Capturing to damage the enemy structure, like Bxc6 provoking ...dxc6 and doubling Black's pawns, is a standard positional weapon even when it wins no material immediately.",
      "",
      "Structure also tells you where to play. With a queenside pawn majority, advance it to manufacture a passed pawn. Against an isolated enemy pawn, blockade it with a knight and pile pressure on it. Let the pawns whisper the plan.",
      "",
      "The exercises cover pushing the passed pawn, inflicting doubled pawns, striking with the central break cxd5, and recognizing the isolated pawn as a long-term target. Before pushing any pawn, ask what squares it weakens forever.",
    ].join("\n"),
  },
  {
    id: "lesson-planning",
    conceptId: "planning",
    level: 1,
    title: "Middlegame Planning: From Structure to Idea",
    objective: "Form simple plans from pawn structure and piece activity: central breaks, minority attacks, and improving the worst piece.",
    exerciseIds: ["ex-pln-1", "ex-pln-2", "ex-pln-3", "ex-pln-4"],
    contentMd: [
      "A plan is a short sequence of moves serving one idea. Beginners play move-to-move, reacting; improving players play idea-to-idea. Good plans come from the position's features, not from wishful thinking. Ask three questions: What are the pawn structure's demands? Which of my pieces is worst placed? What is my opponent trying to do?",
      "",
      "The most reliable plans are simple. In open positions with a lead in development, the central break (d4 against ...e5) opens lines for your better-placed pieces. With a queenside pawn majority, push it (b4-b5) to create a passed pawn on the far side from the enemy king. With a space advantage, improve your worst piece before acting. When you are ahead in material, the plan is simplification: trade pieces, not pawns, and the endgame wins itself.",
      "",
      "A plan should also include the opponent's idea. If Black wants ...f5 to break out, your plan might be to prevent it or to meet it under favorable circumstances. Planning is a dialogue, not a monologue.",
      "",
      "In the exercises you will choose the central break, launch the minority attack, simplify a winning position, and judge whether a plan fits the position. One clear idea, pursued for five moves, beats five unrelated good moves.",
    ].join("\n"),
  },
  {
    id: "lesson-exchanges",
    conceptId: "exchanges",
    level: 1,
    title: "Exchanges & Material Imbalances",
    objective: "Trade when ahead, keep tension when behind, recapture correctly, and understand basic imbalances.",
    exerciseIds: ["ex-exc-1", "ex-exc-2", "ex-exc-3", "ex-exc-4"],
    contentMd: [
      "Every exchange is a decision, and the rule of thumb is direction: when you are ahead in material, trade pieces (not pawns); when you are worse, avoid trades and keep complications. Trading the queens when a piece up usually converts a win into a trivially won endgame. Trading when down the exchange just accelerates the loss.",
      "",
      "Recaptures deserve care. Recapture with the piece that keeps your structure sound and your pieces active; automatic recaptures with the wrong piece can saddle you with doubled pawns or a passive game. When the opponent blunders a piece, take it with the move that also improves your position.",
      "",
      "Not all material is equal in every position. Bishop versus knight depends on the pawn structure: bishops love open positions with pawns on both wings, knights love closed centers and outposts. The exchange (rook for minor piece) favors the side with the initiative. A sound sacrifice, like the Fried Liver's Nxf7, gives up material for a lasting attack against an exposed king; an unsound one just loses material.",
      "",
      "The exercises drill the core habits: simplify when winning (trade queens a piece up), find the famous Nxf7 sacrifice, choose the right recapture instead of the panicky one, and refuse the simplifying trade when you are worse. Ask before every trade: does this help the player who is ahead? Then make sure that player is you.",
    ].join("\n"),
  },
  {
    id: "lesson-kpk-endgame",
    conceptId: "kpk-endgame",
    level: 1,
    title: "King & Pawn Endgames: Opposition and the Square",
    objective: "Use the square rule to judge pawn races and the opposition to shepherd a pawn through.",
    exerciseIds: ["ex-kpk-1", "ex-kpk-2", "ex-kpk-3", "ex-kpk-4"],
    contentMd: [
      "King and pawn endgames are pure calculation, and two tools solve most of them. The square rule: draw a square from the pawn to its promotion square (for a pawn on d4 promoting on d8, the square is d4-d8-h8-h4). If the enemy king is inside the square, it catches the pawn; if outside, the pawn queens. Count with the move: if it is your move, the square effectively shrinks by one.",
      "",
      "The opposition: when the kings stand on the same file, rank, or diagonal with one square between them, the side NOT to move has the opposition, and the side to move must give way. With a pawn on the sixth rank, getting your king to a key square (d6, e6, f6 for an e-pawn) in front of the pawn wins regardless of who moves. The winning technique is almost always: king in front of the pawn, opposition at the critical moment, pawn advances under the king's escort.",
      "",
      "Three habits: (1) In pawn races, count, don't guess; use the square. (2) Keep your king ahead of your pawn, not behind it. (3) When in doubt, take the opposition before pushing; a premature pawn push often lets the enemy king slip in front and draw.",
      "",
      "The exercises test the square rule in a race, the diagonal opposition that wins a pawn endgame, pushing when the pawn outruns the king, and the basic vocabulary question: who has the opposition? Endgames reward precision; there are no style points, only correct moves.",
    ].join("\n"),
  },
  {
    id: "lesson-rook-endgame",
    conceptId: "rook-endgame",
    level: 1,
    title: "Rook Endgames: The Seventh Rank, Lucena, Philidor",
    objective: "Activate the rook, build the Lucena bridge, and hold the Philidor draw.",
    exerciseIds: ["ex-re-1", "ex-re-2", "ex-re-3", "ex-re-4"],
    contentMd: [
      "Rook endgames are the most common endgames in practice, and technique matters more than calculation. The attacking ideas: get your rook to the seventh rank, where it attacks pawns and restricts the enemy king; cut the enemy king off from the pawn with your rook; and keep your rook active, checking from behind rather than passively defending.",
      "",
      "The Lucena position (king + rook + pawn vs king + rook, pawn on the seventh, your king in front of it) is the fundamental win. The method is the bridge: get your rook to the fourth rank (counting from your side), then walk the king out from behind the pawn while the rook shields it from checks: Rh4, and after the checks, Kg3-g2-g1 with the rook on g4 covering. Memorize the shape, not the move order: rook on the fourth, king steps out, promote.",
      "",
      "The Philidor position is the fundamental draw: defending rook + king vs rook + pawn. Keep your rook on the third rank (from your side), checking the enemy king from behind whenever it advances, and keep your king in front of the pawn. Never let your rook get trapped on the back rank and never push the pawn's... rather, never allow the attacking king to reach the sixth rank with your king cut off.",
      "",
      "In the exercises you will seize the seventh rank, finish the basic rook-and-king mate, build the Lucena bridge (Rg4!), and recognize a well-placed rook on an open file. Rook endings are won by activity and lost by passivity.",
    ].join("\n"),
  },
  {
    id: "lesson-decisions",
    conceptId: "decisions",
    level: 1,
    title: "Practical Decision-Making: Technique Under Pressure",
    objective: "Simplify when winning, complicate when worse, choose the safe win, and manage risk.",
    exerciseIds: ["ex-dec-1", "ex-dec-2", "ex-dec-3", "ex-dec-4"],
    contentMd: [
      "Winning a won position is a separate skill from getting one. The practical rules: when you are a piece up, trade pieces, especially queens and rooks; every exchange reduces the opponent's counterplay and your own blunder surface. Choose the safe win over the brilliant one: a forced simplification into a winning endgame beats a speculative attack that could go wrong.",
      "",
      "When you are worse, invert the rules. Avoid simplification; keep pieces on the board, especially queens, because complications are your lottery ticket. Attack the stronger side's king, push passed pawns, and set problems. Many lost positions are saved not by perfect defense but by making the win as difficult as possible.",
      "",
      "Risk management also means knowing when NOT to calculate deeply. In a clearly winning endgame, play the solid centralizing move rather than the flashy tactic. In time trouble, prefer moves that do not lose outright over moves that might win brilliantly. And always, before the final blow, check for stalemate: the most painful way to throw a win is to leave the enemy king with no legal moves.",
      "",
      "The exercises are pure judgment: trade rooks a piece up, refuse the simplifying trade a pawn down, take the safe queen trade instead of the adventure, and confirm the practical rule explicitly. Technique is just good decisions repeated.",
    ].join("\n"),
  },
];

export const EXERCISES: Exercise[] = [
  // ---------------- rules-checkmates (difficulty 5-15) ----------------
  {
    id: "ex-rules-1",
    conceptId: "rules-checkmates",
    kind: "find-move",
    fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1",
    prompt: "White to move. Deliver checkmate in one move.",
    solutionUci: ["a1a8"],
    hints: [
      "The black king is trapped on the back rank by its own pawns. Look for a check along the back rank.",
      "Your rook on a1 can reach the 8th rank. Which square gives check that the king cannot escape?",
      "Play Ra8#. The king cannot go to f8 or h8 (the rook covers both), and its own pawns block g7 and f7.",
    ],
    explanation:
      "1. Ra8# is the classic back-rank mate. The black king on g8 is in check from the rook, cannot move to f8 or h8 because the rook covers the entire 8th rank, and its own pawns on f7 and g7 block every other escape. When the back rank is sealed by pawns, a rook check there is decisive.",
    difficulty: 8,
  },
  {
    id: "ex-rules-2",
    conceptId: "rules-checkmates",
    kind: "find-move",
    fen: "6k1/5ppp/8/8/8/8/8/4Q1K1 w - - 0 1",
    prompt: "White to move. Deliver checkmate in one move.",
    solutionUci: ["e1e8"],
    hints: [
      "The queen is even stronger than the rook on the back rank. Find the check the king cannot answer.",
      "Qe8+ attacks the king along the 8th rank. Can Black block the check or move the king?",
      "Play Qe8#. Nothing can block, and f8 and h8 are both covered by the queen.",
    ],
    explanation:
      "1. Qe8# mates for the same reason as the rook version: the queen checks along the back rank, covers f8 and h8, and the pawn wall on f7/g7/h7 traps the king. Always verify the mating square cannot be captured and no piece can interpose.",
    difficulty: 10,
  },
  {
    id: "ex-rules-3",
    conceptId: "rules-checkmates",
    kind: "choose-move",
    fen: "7k/8/6K1/8/8/8/8/4R3 w - - 0 1",
    prompt: "White to move. Which move checkmates?",
    solutionUci: ["e1e8"],
    choices: ["e1e8", "e1e7", "e1h1", "e1a1"],
    hints: [
      "Only one of these gives check. Start by finding the checking move.",
      "Re8+ checks the king on h8 along the 8th rank. Now verify it is mate, not just check.",
      "Re8# is mate: the white king on g6 covers h7 and g7, the rook covers g8, and h8 is under attack. The quiet rook moves change nothing.",
    ],
    explanation:
      "1. Re8# is mate because the black king on h8 has no flight square: g8 is covered by the rook, h7 and g7 by the white king on g6. The other rook moves (Re7, Rh1, Ra1) are pointless waiting moves. When mating, use your king as a helper to cover escape squares.",
    difficulty: 12,
  },
  {
    id: "ex-rules-4",
    conceptId: "rules-checkmates",
    kind: "yes-no",
    fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1",
    prompt: "Black to move. Is this stalemate?",
    solutionUci: ["yes"],
    hints: [
      "Stalemate needs two things: no legal moves AND not in check. Check both.",
      "The black king on h8 cannot move to g8 (queen covers it) or h7/g7 (white king covers them). Is the king in check?",
      "Yes, stalemate. The queen on f7 does not attack h8, so Black is not in check but has no move: an instant draw.",
    ],
    explanation:
      "Yes, this is stalemate, and the game is drawn. Black's king has no legal square (g8 is covered by the queen, h7 and g7 by the white king) and is not in check. This is the most common way beginners throw away wins: always leave the losing king one legal move until the mating move.",
    difficulty: 14,
  },

  // ---------------- development (difficulty 12-22) ----------------
  {
    id: "ex-dev-1",
    conceptId: "development",
    kind: "find-move",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
    prompt: "White to move (1. e4 e5 2. Nf3 Nc6). Develop a piece.",
    solutionUci: ["b1c3"],
    acceptableUci: [["f1c4"], ["f1b5"]],
    hints: [
      "Knights before bishops is the classic guideline. Which knight can come out now?",
      "Nc3 develops toward the center and prepares d4. The bishop can also come to c4 or b5.",
      "Play 1. Nc3 (or Bc4/Bb5). All develop a piece to an active central square.",
    ],
    explanation:
      "1. Nc3 is the natural developing move: the knight heads for the center and supports the d4 push. 1. Bc4 and 1. Bb5 are equally principled. The idea is the same every time: bring pieces out to active squares instead of shuffling the same piece.",
    difficulty: 12,
  },
  {
    id: "ex-dev-2",
    conceptId: "development",
    kind: "find-move",
    fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    prompt: "White to move (1. e4 e5). Develop a piece. Do not bring the queen out early.",
    solutionUci: ["b1c3"],
    acceptableUci: [["g1f3"], ["f1c4"]],
    hints: [
      "The queen is your most valuable piece; moving it early lets Black develop by attacking it.",
      "Develop a knight (Nc3 or Nf3) or a bishop (Bc4). All follow the knights-before-bishops guideline loosely.",
      "Play Nc3, Nf3, or Bc4. Leave the queen home until the minor pieces are out.",
    ],
    explanation:
      "Developing a knight or bishop is correct; 2. Qh5?! would be met by 2...Nc6, developing with a gain of time by attacking the queen. Early queen moves look aggressive but donate tempi to the opponent.",
    difficulty: 14,
  },
  {
    id: "ex-dev-3",
    conceptId: "development",
    kind: "choose-move",
    fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    prompt: "White to move. What is the most principled move?",
    solutionUci: ["e1g1"],
    choices: ["e1g1", "g2g4", "d2d4", "b1c3"],
    hints: [
      "Your king is still in the center and Black's bishops are out. What does king safety demand?",
      "Castling (O-O) tucks the king away and connects the rooks in one move. g4 weakens the king badly.",
      "Castle: 1. O-O. d4 and Nc3 are reasonable developing moves, but king safety comes first.",
    ],
    explanation:
      "1. O-O is the most principled: the king reaches safety and the rooks connect. 1. g4?? would be a serious weakening of the kingside with no justification. Develop, but never at the cost of leaving the king in the center when the position starts to open.",
    difficulty: 18,
  },
  {
    id: "ex-dev-4",
    conceptId: "development",
    kind: "yes-no",
    fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
    prompt: "Black to move (1. e4 e5 2. Nf3). Is 2...Qh4 a good developing move?",
    solutionUci: ["no"],
    hints: [
      "Ask what the queen does on h4: does it threaten anything real, and what does it cost?",
      "The queen attacks nothing decisive, and White gains time against it while developing.",
      "No. It brings the queen out before the minor pieces, violating the knights-before-bishops-before-queen order, and achieves nothing.",
    ],
    explanation:
      "No. 2...Qh4 breaks the development order for no benefit: the queen will be chased while Black's knights and bishops sit home. Good developing moves after 2. Nf3 are 2...Nc6, 2...Nf6, or 2...d6.",
    difficulty: 16,
  },

  // ---------------- center (difficulty 18-28) ----------------
  {
    id: "ex-cen-1",
    conceptId: "center",
    kind: "find-move",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
    prompt: "White to move. Challenge Black's center.",
    solutionUci: ["d2d4"],
    acceptableUci: [["b1c3"]],
    hints: [
      "Black's e5 pawn controls the center unchallenged. Which pawn push contests it?",
      "d4 attacks e5 directly and opens lines for the c1 bishop.",
      "Play 1. d4. Seizing central space is more important than another developing move here.",
    ],
    explanation:
      "1. d4 challenges the e5 pawn immediately and builds the classical two-pawn center. Letting Black keep ...e5 for free would concede the central battle before it starts.",
    difficulty: 18,
  },
  {
    id: "ex-cen-2",
    conceptId: "center",
    kind: "find-move",
    fen: "rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 2 3",
    prompt: "White to move (1. d4 Nf6 2. c4). Build the pawn center.",
    solutionUci: ["e2e4"],
    acceptableUci: [["b1c3"], ["g1f3"]],
    hints: [
      "You have pawns on c4 and d4. Which pawn push completes the big center?",
      "e4 gives you pawns on c4, d4, and e4: a commanding central presence.",
      "Play 1. e4. A broad pawn center cramps Black and gives every piece room.",
    ],
    explanation:
      "1. e4 completes a powerful three-pawn center (c4, d4, e4). Central pawns control key squares and give the pieces behind them maximum scope. This is the strategic payoff for fighting for the middle of the board.",
    difficulty: 20,
  },
  {
    id: "ex-cen-3",
    conceptId: "center",
    kind: "choose-move",
    fen: "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    prompt: "White to move (1. e4 d5). How should White meet the central counter?",
    solutionUci: ["e4d5"],
    choices: ["e4d5", "e4e5", "g1f3", "b1c3"],
    hints: [
      "Black's d5 pawn challenges your center. You can capture it or push past it.",
      "Capturing toward the center (exd5) keeps your pawn on a central square; e5 would block the position with no benefit.",
      "Play 1. exd5. Capture toward the center, not away from it.",
    ],
    explanation:
      "1. exd5 captures toward the center, keeping White's pawn on the central d5 square. 1. e5 would close the position prematurely and let Black develop comfortably. When in doubt, captures that centralize are usually right.",
    difficulty: 22,
  },
  {
    id: "ex-cen-4",
    conceptId: "center",
    kind: "yes-no",
    fen: "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1",
    prompt: "White to move (1. e4 e6). Is 2. d4, occupying the center, a principled move?",
    solutionUci: ["yes"],
    hints: [
      "What does d4 do for White's central control?",
      "It builds the e4/d4 pawn duo, the classical ideal, and opens the bishop.",
      "Yes. Occupying the center with pawns is the most direct way to fight for it.",
    ],
    explanation:
      "Yes. 2. d4 is the principled reply, establishing the classical pawn center. Against 1...e6 Black has conceded some central space, and White should take it.",
    difficulty: 18,
  },

  // ---------------- king-safety (difficulty 20-30) ----------------
  {
    id: "ex-ks-1",
    conceptId: "king-safety",
    kind: "find-move",
    fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    prompt: "White to move. Secure your king.",
    solutionUci: ["e1g1"],
    acceptableUci: [["b1c3"], ["d2d3"]],
    hints: [
      "Your king is still on e1 and Black's pieces are developing fast. What is the one move that tucks it away?",
      "Castling kingside (O-O) is legal: neither king nor rook has moved and the squares are empty.",
      "Play 1. O-O. A castled king behind unmoved pawns is the foundation of every plan.",
    ],
    explanation:
      "1. O-O gets the king to safety and connects the rooks. With both bishops developed and the center about to open, leaving the king on e1 would be asking for trouble.",
    difficulty: 20,
  },
  {
    id: "ex-ks-2",
    conceptId: "king-safety",
    kind: "find-move",
    fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 0 1",
    prompt: "Black to move. White has castled. What should Black do about the king?",
    solutionUci: ["e8g8"],
    hints: [
      "White's king is safe. Where is Black's king, and what is the symmetric answer?",
      "Black can also castle kingside: the squares between king and rook are empty.",
      "Play 1...O-O. Never leave your king in the center once the opponent is castled and developing.",
    ],
    explanation:
      "1...O-O mirrors White's king safety. With White castled and pieces coming, Black's king on e8 would be a target the moment the center opens. Castle first, ask questions later.",
    difficulty: 22,
  },
  {
    id: "ex-ks-3",
    conceptId: "king-safety",
    kind: "choose-move",
    fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    prompt: "White to move. Which move best secures the king?",
    solutionUci: ["e1g1"],
    choices: ["e1g1", "g2g4", "d2d4", "b1c3"],
    hints: [
      "One of these moves the king to safety; one of them wrecks the pawn shelter. Tell them apart.",
      "g4 pushes a pawn in front of the future castled king, opening lines for nothing. Castling does the opposite.",
      "Castle with 1. O-O. d4 and Nc3 develop nicely but leave the king job undone.",
    ],
    explanation:
      "1. O-O is the king-safety move. 1. g4?? would be a positional blunder, stripping the pawn cover for zero compensation. Pawn moves in front of your castled king are commitments: make them only with a concrete reason.",
    difficulty: 24,
  },
  {
    id: "ex-ks-4",
    conceptId: "king-safety",
    kind: "yes-no",
    fen: "rnbqk1nr/pppp1ppp/8/2b1p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3",
    prompt: "Black to move (1. e4 e5 2. Bc4 Bc5 3. Qh5). White's queen is out early. Can Black safely ignore it and just develop?",
    solutionUci: ["yes"],
    hints: [
      "Does Qh5 actually threaten anything? Look for mate threats and hanging pieces.",
      "There is no mate: Qxf7+ is answered by Kd8 ideas, and nothing is hanging. The queen is just misplaced.",
      "Yes. Black develops (3...Nc6 or 3...Qe7) and the early queen becomes a target, not a threat.",
    ],
    explanation:
      "Yes. 3. Qh5 looks scary but threatens nothing concrete, so Black should not panic. Developing with 3...Nc6 or 3...Nf6 (carefully) turns the tables: the queen will have to move again. Judge threats by what they actually attack, not by how aggressive they look.",
    difficulty: 26,
  },

  // ---------------- hanging-pieces (difficulty 15-25) ----------------
  {
    id: "ex-hp-1",
    conceptId: "hanging-pieces",
    kind: "find-move",
    fen: "6k1/5ppp/8/4r3/3P4/8/5PPP/4R1K1 w - - 0 1",
    prompt: "White to move. Win the hanging piece.",
    solutionUci: ["d4e5"],
    acceptableUci: [["e1e5"]],
    hints: [
      "Scan Black's pieces: which one has no defender? Pawns capture diagonally.",
      "The rook on e5 is undefended, and your d-pawn attacks it.",
      "Play 1. dxe5 (1. Rxe5 works too). A free rook decides the game on the spot.",
    ],
    explanation:
      "1. dxe5 wins a whole rook because the rook on e5 has no defender. (1. Rxe5 also wins.) Always scan for undefended enemy pieces before calculating anything fancy: most points are dropped and won right here.",
    difficulty: 15,
  },
  {
    id: "ex-hp-2",
    conceptId: "hanging-pieces",
    kind: "find-move",
    fen: "6k1/5ppp/8/8/3q4/5N2/5PPP/6K1 w - - 0 1",
    prompt: "White to move. The black queen wandered too far. Punish it.",
    solutionUci: ["f3d4"],
    hints: [
      "Knights attack in an L-shape. From f3, which squares does your knight hit?",
      "The knight attacks d4, where the undefended black queen sits.",
      "Play 1. Nxd4. The queen has no defender and no escape that saves it.",
    ],
    explanation:
      "1. Nxd4 wins the queen: it was undefended on d4 and the knight fork of squares gave it nowhere safe to go. Queens that grab pawns or wander often end up hanging; be the player who notices.",
    difficulty: 18,
  },
  {
    id: "ex-hp-3",
    conceptId: "hanging-pieces",
    kind: "choose-move",
    fen: "6k1/5ppp/8/4r3/3P4/2N5/5PPP/6K1 w - - 0 1",
    prompt: "White to move. Which move wins material?",
    solutionUci: ["d4e5"],
    choices: ["d4e5", "c3d5", "c3b5", "g1f1"],
    hints: [
      "Look at Black's rook on e5: is it defended? What attacks it?",
      "Your d-pawn attacks e5 diagonally, and nothing defends the rook.",
      "Play 1. dxe5. The knight moves are harmless shuffling; only the pawn capture wins.",
    ],
    explanation:
      "1. dxe5 wins the rook for a pawn. The other moves develop or wait but miss the tactic. Train the reflex: undefended piece plus an attacker equals a capture, unless a concrete reason says otherwise.",
    difficulty: 20,
  },
  {
    id: "ex-hp-4",
    conceptId: "hanging-pieces",
    kind: "yes-no",
    fen: "rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2",
    prompt: "After 1. e4 Nf6, Black attacks your e-pawn. It is undefended. Is the pawn hanging?",
    solutionUci: ["yes"],
    hints: [
      "A piece is hanging when it is attacked and undefended. Count attackers and defenders of e4.",
      "The knight on f6 attacks e4; nothing defends it.",
      "Yes. The pawn is en prise. White must defend it (2. Nc3) or move it.",
    ],
    explanation:
      "Yes, the e-pawn is hanging: attacked once by the knight and defended zero times. This is the blunder check in action. White's normal reply is 2. Nc3, defending the pawn while developing.",
    difficulty: 16,
  },

  // ---------------- tactics (difficulty 25-40) ----------------
  {
    id: "ex-tac-1",
    conceptId: "tactics",
    kind: "find-move",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
    prompt: "White to move. Pin the black knight.",
    solutionUci: ["f1b5"],
    acceptableUci: [["d2d4"]],
    hints: [
      "A pin freezes a piece against something more valuable behind it. What stands behind the c6 knight?",
      "The black king on e8. A bishop on b5 would line up b5-c6-d7-e8.",
      "Play 1. Bb5. The knight cannot move without exposing the king.",
    ],
    explanation:
      "1. Bb5 pins the c6 knight to the black king along the b5-e8 diagonal. Pinned pieces are tactically dead: they cannot move, and pressure against them usually wins material. d4 is also fine, but the pin is the thematic shot.",
    difficulty: 25,
  },
  {
    id: "ex-tac-2",
    conceptId: "tactics",
    kind: "find-move",
    fen: "3r3k/5ppp/8/4N3/8/8/5PPP/6K1 w - - 0 1",
    prompt: "White to move. Fork the king and rook.",
    solutionUci: ["e5f7"],
    hints: [
      "A knight fork attacks two pieces at once. From where can your knight check the king on h8?",
      "Nf7+ checks the king (the knight attacks h8) and also attacks the rook on d8.",
      "Play 1. Nf7+. After 1...Kg8, 2. Nxd8 wins the rook.",
    ],
    explanation:
      "1. Nf7+ is a royal fork: it checks the king on h8 and attacks the rook on d8 simultaneously. Black must move the king (1...Kg8), and 2. Nxd8 wins the exchange and the game. Always look for checks that attack something else at the same time.",
    difficulty: 32,
  },
  {
    id: "ex-tac-3",
    conceptId: "tactics",
    kind: "choose-move",
    fen: "4k3/8/8/8/4N3/8/5PPP/4R1K1 w - - 0 1",
    prompt: "White to move. Find the crushing discovered check.",
    solutionUci: ["e4f6"],
    choices: ["e4f6", "e4d6", "e4c5", "e1e2"],
    hints: [
      "A discovered attack uncovers a line piece. If the knight moves from e4, what opens?",
      "Nothing yet, but Nf6+ is check from the knight AND uncovers Re1 on the e-file: a double check.",
      "Play 1. Nf6+. Double check forces the king to move, and White's initiative becomes overwhelming.",
    ],
    explanation:
      "1. Nf6+ is a double check: the knight checks from f6 and uncovers the rook's attack down the e-file. Against a double check the king must move, and Black's position collapses. The quiet knight moves miss the forcing idea entirely.",
    difficulty: 38,
  },
  {
    id: "ex-tac-4",
    conceptId: "tactics",
    kind: "yes-no",
    fen: "3qk3/5ppp/8/4N3/8/8/5PPP/4R1K1 w - - 0 1",
    prompt: "White to move. Does 1. Nxf7 fork the king and the queen?",
    solutionUci: ["no"],
    hints: [
      "A fork must attack BOTH targets. After Nxf7, is the black king in check?",
      "The knight on f7 attacks the queen on d8, but the king on e8 is not attacked: it is not check.",
      "No. It wins a pawn and attacks the queen, but a fork of king and queen must give check. Precision matters.",
    ],
    explanation:
      "No. 1. Nxf7 attacks the queen but does not check the king, so Black simply moves the queen. A true fork hits both targets at once. Do not play a 'fork' that lets the opponent answer the threat for free.",
    difficulty: 30,
  },

  // ---------------- calculation (difficulty 30-45) ----------------
  {
    id: "ex-cal-1",
    conceptId: "calculation",
    kind: "find-move",
    fen: "5rk1/5ppp/8/8/8/8/5PPP/R3Q1K1 w - - 0 1",
    prompt: "White to move and mate in 2. Find the forcing first move.",
    solutionUci: ["e1e8"],
    hints: [
      "Forcing moves (checks, captures) narrow the opponent's replies. Start with a check.",
      "Qe8+ forces Black's only legal reply. What is it, and what follows?",
      "Play 1. Qe8+! After 1...Rxe8 (forced), 2. Raxe8# is mate: the back rank is sealed.",
    ],
    explanation:
      "1. Qe8+! is a clearance sacrifice: Black has only 1...Rxe8, and then 2. Raxe8# mates because the rook covers f8 and h8 while the pawns block the king. Calculate forcing lines to the end before playing them; here every Black reply was forced.",
    difficulty: 38,
  },
  {
    id: "ex-cal-2",
    conceptId: "calculation",
    kind: "find-move",
    fen: "r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1",
    prompt: "White to move. Calculate: which move wins a pawn in two moves?",
    solutionUci: ["b5c6"],
    hints: [
      "The e5 pawn is currently defended by the c6 knight. How do you remove the defender?",
      "Bxc6 forces ...dxc6 (or ...bxc6), and then the e5 pawn is loose.",
      "Play 1. Bxc6 dxc6 2. Nxe5, winning the pawn. Calculate the recapture before sacrificing the bishop.",
    ],
    explanation:
      "1. Bxc6! removes the defender of e5 (1...dxc6 2. Nxe5 wins the pawn; 1...bxc6 2. Nxe5 does the same). This is a two-move calculation: see the defender, remove it, then take. Always verify the opponent's recapture before giving up the bishop.",
    difficulty: 42,
  },
  {
    id: "ex-cal-3",
    conceptId: "calculation",
    kind: "choose-move",
    fen: "6k1/5ppp/8/8/8/8/5PPP/2R3K1 w - - 0 1",
    prompt: "White to move. Calculate to the end: which move mates immediately?",
    solutionUci: ["c1c8"],
    choices: ["c1c8", "c1c7", "c1a1", "g1h1"],
    hints: [
      "Mate in 1 must be check with no escape. Test each candidate to the end.",
      "Rc8+ checks along the back rank. Can the king move to f8 or h8? Are they covered?",
      "1. Rc8# is mate: f8 and h8 are covered by the rook and the pawns block the rest. The other moves are not even check.",
    ],
    explanation:
      "1. Rc8# mates: the rook checks on the back rank, covers f8 and h8, and Black's own pawns seal the king in. Calculation means verifying, not hoping; here the verification takes five seconds and the point is free.",
    difficulty: 32,
  },
  {
    id: "ex-cal-4",
    conceptId: "calculation",
    kind: "yes-no",
    fen: "6k1/5ppp/8/8/8/8/5PPP/2R3K1 w - - 0 1",
    prompt: "White to move. Is 1. Rc8# checkmate?",
    solutionUci: ["yes"],
    hints: [
      "Check: does Rc8 attack the king? Then list every king move and capture.",
      "The rook checks on the back rank; f8 and h8 are covered; the pawns block g7/f7.",
      "Yes. It is mate, so play it with confidence instead of 'playing safe' and missing the point.",
    ],
    explanation:
      "Yes, 1. Rc8# is checkmate, as verified: check along the back rank, both flight squares covered, pawn wall intact. When calculation proves a mate, play it; second-guessing a forced win is a practical leak.",
    difficulty: 30,
  },

  // ---------------- openings (difficulty 22-32) ----------------
  {
    id: "ex-op-1",
    conceptId: "openings",
    kind: "find-move",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
    prompt: "White to move (1. e4 e5 2. Nf3 Nc6). Play the Italian Game.",
    solutionUci: ["f1c4"],
    acceptableUci: [["b1c3"], ["d2d4"]],
    hints: [
      "The Italian Game develops the kingside bishop to its most aggressive diagonal.",
      "Bc4 eyes f7, the weakest square near Black's king, and prepares castling.",
      "Play 1. Bc4. (1. Nc3 and 1. d4 are also principled.)",
    ],
    explanation:
      "1. Bc4 is the Italian Game: the bishop develops to an active diagonal, eyes the f7 weakness, and White is one move from castling. This is opening by principle, not memorization: develop, pressure the center, get the king safe.",
    difficulty: 22,
  },
  {
    id: "ex-op-2",
    conceptId: "openings",
    kind: "find-move",
    fen: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1",
    prompt: "Black to move (1. d4). Answer with a principled move.",
    solutionUci: ["g8f6"],
    acceptableUci: [["d7d5"]],
    hints: [
      "White occupies the center with d4. Challenge it with a piece or a pawn.",
      "1...Nf6 develops and attacks d4; 1...d5 occupies the center symmetrically.",
      "Play 1...Nf6 (or 1...d5). Both fight for the center instead of conceding it.",
    ],
    explanation:
      "1...Nf6 develops a knight toward the center and pressures d4; 1...d5 meets the pawn head-on. Either follows the principles. Passive moves like 1...a6 would let White build the ideal center for free.",
    difficulty: 24,
  },
  {
    id: "ex-op-3",
    conceptId: "openings",
    kind: "choose-move",
    fen: "rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2",
    prompt: "Black to move (1. e4 e5 2. Qh5?!). Punish the early queen the principled way.",
    solutionUci: ["b8c6"],
    acceptableUci: [["d8e7"]],
    choices: ["b8c6", "g8f6", "d8e7", "h7h6"],
    hints: [
      "The queen on h5 is misplaced but not immediately lost. What is the calm, developing reply?",
      "Develop with tempo: Nc6 attacks nothing yet but brings a piece out and prepares ...Nf6.",
      "Play 2...Nc6. (2...Qe7 is solid too.) Do not play 2...Nf6?? walking into tactics, and do not waste time on 2...h6.",
    ],
    explanation:
      "2...Nc6 is the principled punishment: develop while the queen sits awkwardly, and it will have to move again. 2...Nf6?? blunders to tactics around e5, and 2...h6 is a wasted tempo. Against early queen sorties, develop; the queen refutes itself.",
    difficulty: 30,
  },
  {
    id: "ex-op-4",
    conceptId: "openings",
    kind: "yes-no",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
    prompt: "White to move (1. e4 e5 2. Nf3 Nc6). Is 3. Bb5 (the Ruy Lopez) a principled developing move?",
    solutionUci: ["yes"],
    hints: [
      "Does Bb5 develop a piece, fight for the center, or prepare castling?",
      "It develops the bishop actively and pressures the c6 knight (the defender of e5).",
      "Yes. The Ruy Lopez is one of the most principled openings in chess.",
    ],
    explanation:
      "Yes. 3. Bb5 develops with a threat in the making (pressure on the e5 defender) and follows every opening principle. The Italian (3. Bc4) and the Ruy Lopez are the two model developing moves here.",
    difficulty: 24,
  },

  // ---------------- activity (difficulty 25-35) ----------------
  {
    id: "ex-act-1",
    conceptId: "activity",
    kind: "find-move",
    fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
    prompt: "White to move. Activate your rook to its most powerful square.",
    solutionUci: ["e1e7"],
    hints: [
      "Rooks belong on open files and the seventh rank. Where can this rook go?",
      "Re7 invades the seventh rank, attacking the f7 pawn and tying Black down.",
      "Play 1. Re7. A rook on the seventh is worth nearly a pawn more than a passive one.",
    ],
    explanation:
      "1. Re7 puts the rook on the seventh rank, the most powerful outpost for a rook: it attacks f7, restricts the black king, and prepares to double or invade further. Activity is not abstract; it is squares like e7.",
    difficulty: 26,
  },
  {
    id: "ex-act-2",
    conceptId: "activity",
    kind: "find-move",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
    prompt: "White to move. Develop your bishop to its most active square.",
    solutionUci: ["f1c4"],
    acceptableUci: [["f1b5"]],
    hints: [
      "Compare the bishop's possible diagonals: which one points at the enemy kingside?",
      "Bc4 eyes f7 and supports the center; Be2 would be passive by comparison.",
      "Play 1. Bc4. Maximum activity now; you can always reposition later.",
    ],
    explanation:
      "1. Bc4 is the active choice: the bishop commands a long diagonal toward f7 and the center. 1. Be2 would be safe but passive. When two developing moves both follow principles, take the more active one.",
    difficulty: 25,
  },
  {
    id: "ex-act-3",
    conceptId: "activity",
    kind: "choose-move",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P2N/8/PPPP1PPP/RNBQKB1R w KQkq - 0 1",
    prompt: "White to move. Your knight is on the rim (h4). Centralize it.",
    solutionUci: ["h4f3"],
    choices: ["h4f3", "h4f5", "h4g6", "d2d4"],
    hints: [
      "Knights on the rim control few squares. Which square returns this knight to the action?",
      "Nf3 brings it back to its best square, eyeing the center and the kingside.",
      "Play 1. Nf3. The rim is dim: a centralized knight influences twice the squares.",
    ],
    explanation:
      "1. Nf3 rescues the misplaced knight to its ideal post. 1. Nf5 looks active but the knight is loose and can be chased; 1. Ng6 wanders further. When a piece is badly placed, improving it is often the best plan on the board.",
    difficulty: 30,
  },
  {
    id: "ex-act-4",
    conceptId: "activity",
    kind: "yes-no",
    fen: "6k1/5ppp/8/8/8/8/5PPP/N5K1 w - - 0 1",
    prompt: "White to move. Is the knight on a1 well placed?",
    solutionUci: ["no"],
    hints: [
      "Count the squares a knight on a1 attacks.",
      "Two: b3 and c2. A centralized knight attacks eight.",
      "No. Cornered knights are the worst-placed pieces in chess; activate it at once.",
    ],
    explanation:
      "No. A knight on a1 attacks only b3 and c2 and takes several moves to rejoin the game. Piece activity is measurable: compare where the piece is with where it wants to be, and the gap is your plan.",
    difficulty: 25,
  },

  // ---------------- pawn-structure (difficulty 30-42) ----------------
  {
    id: "ex-ps-1",
    conceptId: "pawn-structure",
    kind: "find-move",
    fen: "4k3/8/8/3P4/8/8/5PPP/6K1 w - - 0 1",
    prompt: "White to move. Your passed pawn must be pushed.",
    solutionUci: ["d5d6"],
    hints: [
      "The d-pawn has no enemy pawn stopping it: it is passed. What do passed pawns want?",
      "To advance. Every step closer to d8 increases its power and ties Black down.",
      "Play 1. d6. Passed pawns must be pushed; they are your best winning asset.",
    ],
    explanation:
      "1. d6 advances the passed pawn, the single most important pawn in the position. Passed pawns gain strength as they advance because the defender must devote pieces to stopping them. Push them before your opponent organizes a blockade.",
    difficulty: 30,
  },
  {
    id: "ex-ps-2",
    conceptId: "pawn-structure",
    kind: "find-move",
    fen: "r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1",
    prompt: "White to move (1. e4 e5 2. Nf3 Nc6 3. Bb5 a6). Damage Black's pawn structure.",
    solutionUci: ["b5c6"],
    hints: [
      "After ...a6, the bishop is attacked. Instead of retreating, can you trade it for structural damage?",
      "Bxc6 forces ...dxc6 (or ...bxc6), doubling Black's c-pawns.",
      "Play 1. Bxc6. Doubled pawns are a long-term weakness even when no material is won.",
    ],
    explanation:
      "1. Bxc6! doubles Black's pawns after 1...dxc6 (1...bxc6 is similar). This is the Exchange Variation idea: give up the bishop pair to inflict a permanent structural defect. Structure is a long-term asset; the damage outlasts the middlegame.",
    difficulty: 38,
  },
  {
    id: "ex-ps-3",
    conceptId: "pawn-structure",
    kind: "choose-move",
    fen: "rnbqkb1r/ppp2ppp/5n2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4",
    prompt: "White to move. Play the thematic central pawn break.",
    solutionUci: ["c4d5"],
    choices: ["c4d5", "c4c5", "e2e4", "g1f3"],
    hints: [
      "Black's d5 pawn is the base of the center. Which pawn can challenge it?",
      "cxd5 trades a wing pawn for a central pawn and opens the c-file.",
      "Play 1. cxd5. The central break is the standard way to meet a ...d5 setup.",
    ],
    explanation:
      "1. cxd5 is the thematic break: it challenges Black's central strongpoint and opens lines. 1. c5 would close the center and surrender the break forever. Strike at the base of the enemy pawn chain while you can.",
    difficulty: 40,
  },
  {
    id: "ex-ps-4",
    conceptId: "pawn-structure",
    kind: "yes-no",
    fen: "6k1/5ppp/8/8/3p4/3P4/5PPP/6K1 w - - 0 1",
    prompt: "Black's d-pawn has no neighboring pawns: it is isolated. Does that usually make it a long-term weakness?",
    solutionUci: ["yes"],
    hints: [
      "An isolated pawn cannot be defended by another pawn. Who must defend it?",
      "Pieces, which then become tied to passive defense.",
      "Yes. Isolated pawns are long-term targets: blockade them with a knight and pile on pressure.",
    ],
    explanation:
      "Yes. The isolated d-pawn must be defended by pieces, which become passive, and it can never safely advance. The standard plan against it is a knight blockade on d4 plus steady pressure. Structure dictates strategy.",
    difficulty: 32,
  },

  // ---------------- planning (difficulty 35-50) ----------------
  {
    id: "ex-pln-1",
    conceptId: "planning",
    kind: "find-move",
    fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQ1RK1 w kq - 6 6",
    prompt: "White to move. Both sides are developed and the center is fluid. What is the most logical plan?",
    solutionUci: ["d2d4"],
    acceptableUci: [["f1e1"]],
    hints: [
      "With a lead in development and the center still mobile, what pawn break opens the position?",
      "d4 challenges e5 and opens lines for White's better-placed pieces.",
      "Play 1. d4. The central break is the natural plan when you are better developed.",
    ],
    explanation:
      "1. d4 is the thematic plan: it opens the center for White's actively placed pieces and challenges Black's e5 strongpoint. Plans come from the position's features; here development plus a fluid center equals a central break.",
    difficulty: 38,
  },
  {
    id: "ex-pln-2",
    conceptId: "planning",
    kind: "find-move",
    fen: "6k1/8/8/8/2PP4/8/PP3PPP/6K1 w - - 0 1",
    prompt: "White to move. Your pawn majority is on the queenside and the black king is far away. What is the plan?",
    solutionUci: ["b2b4"],
    hints: [
      "A pawn majority should advance to create a passed pawn. Which side is your majority on?",
      "Queenside: pawns on a2, b2, c4, d4. Push them with b4-b5.",
      "Play 1. b4. Advance the majority; the far-away black king cannot stop the resulting passed pawn.",
    ],
    explanation:
      "1. b4 starts the minority... rather, the majority attack: White's queenside pawns will roll forward (b5 next) and manufacture a passed pawn far from the black king. Let the structure choose the battlefield.",
    difficulty: 42,
  },
  {
    id: "ex-pln-3",
    conceptId: "planning",
    kind: "choose-move",
    fen: "r5k1/5ppp/8/8/3P4/8/5PPP/R5K1 w - - 0 1",
    prompt: "White is a pawn up. What is the best plan?",
    solutionUci: ["a1a8"],
    choices: ["a1a8", "a1a2", "a1b1", "g1f1"],
    hints: [
      "When ahead in material, what should you trade? (Think: pieces, not pawns.)",
      "Trading rooks simplifies into a winning king-and-pawn endgame.",
      "Play 1. Rxa8+. Simplification is the plan when you are winning.",
    ],
    explanation:
      "1. Rxa8+ trades the last heavy pieces and heads for a winning pawn endgame a pawn up. When ahead, the plan is simplification: fewer pieces means fewer ways to go wrong and fewer hiding places for counterplay.",
    difficulty: 45,
  },
  {
    id: "ex-pln-4",
    conceptId: "planning",
    kind: "yes-no",
    fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQ1RK1 w kq - 0 1",
    prompt: "White to move, both sides developed. Is 'play d4 to open the center' a reasonable plan?",
    solutionUci: ["yes"],
    hints: [
      "Does White have the development and piece activity to benefit from an open center?",
      "Yes: castled king, developed pieces, and the break challenges e5.",
      "Yes. d4 fits the position's demands: development plus central tension equals a break.",
    ],
    explanation:
      "Yes. Plans must fit the position, and here everything points to d4: White is developed, the king is safe, and the break opens lines for the better-placed army. A good plan is just the position's loudest demand, stated clearly.",
    difficulty: 36,
  },

  // ---------------- exchanges (difficulty 35-48) ----------------
  {
    id: "ex-exc-1",
    conceptId: "exchanges",
    kind: "find-move",
    fen: "3q2k1/5ppp/8/8/8/8/5PPP/3QR1K1 w - - 0 1",
    prompt: "White is ahead (rook vs nothing). Simplify.",
    solutionUci: ["d1d8"],
    hints: [
      "When ahead, trade pieces, not pawns. Which trade simplifies most?",
      "The queens can come off: Qxd8+.",
      "Play 1. Qxd8+. After 1...Kf7 White is still the exchange up with zero counterplay left.",
    ],
    explanation:
      "1. Qxd8+ trades queens when ahead, the textbook simplification. The resulting position is a trivial win: White keeps the extra rook and Black has no activity to compensate. Simplify when winning; complicate when worse.",
    difficulty: 36,
  },
  {
    id: "ex-exc-2",
    conceptId: "exchanges",
    kind: "find-move",
    fen: "r1bqkb1r/ppp2ppp/2n5/3np1N1/2B5/8/PPPP1PPP/RNBQK2R w KQkq - 0 6",
    prompt: "White to move (the Fried Liver position). Find the famous sacrifice.",
    solutionUci: ["g5f7"],
    hints: [
      "Black's king is still in the center and f7 is weak. Which piece can strike there?",
      "The knight on g5 can take on f7, forking queen and rook ideas and exposing the king.",
      "Play 1. Nxf7! After 1...Kxf7 2. Qf3+ White has a crushing attack for the piece.",
    ],
    explanation:
      "1. Nxf7! is the Fried Liver Attack: White sacrifices the knight to drag the black king into the open (1...Kxf7 2. Qf3+ Ke6 3. Nc3+ and the attack crashes through). Sound sacrifices need a concrete follow-up; here the exposed king and White's lead in development provide it.",
    difficulty: 48,
  },
  {
    id: "ex-exc-3",
    conceptId: "exchanges",
    kind: "choose-move",
    fen: "3qr1k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1",
    prompt: "White is down the exchange. Avoid the simplifying trade.",
    solutionUci: ["d1e2"],
    acceptableUci: [["d1c2"]],
    choices: ["d1e2", "d1c2", "d1d8", "f2f4"],
    hints: [
      "When worse, keep pieces on and keep tension. Which move avoids the queen trade?",
      "Qxd8+ Rxd8 would simplify into a dead-lost endgame. Keep the queens on.",
      "Play 1. Qe2 (or 1. Qc2). When behind, complications are your only lottery ticket.",
    ],
    explanation:
      "1. Qe2 avoids the queen trade that would simplify into a hopeless endgame down the exchange. When worse, the practical rule inverts: keep pieces, keep tension, and make the opponent prove the win. 1. Qxd8+? would just speed up the loss.",
    difficulty: 44,
  },
  {
    id: "ex-exc-4",
    conceptId: "exchanges",
    kind: "yes-no",
    fen: "3qr1k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1",
    prompt: "White is down the exchange. Should White trade queens?",
    solutionUci: ["no"],
    hints: [
      "Who benefits from simplification: the player who is ahead or behind?",
      "The player ahead. White is worse, so trades help Black.",
      "No. Keep the queens on and fight; trading just converts Black's advantage cleanly.",
    ],
    explanation:
      "No. Exchanges favor the side that is ahead, so the side that is worse must refuse them. This is the single most practical exchange rule: trade when winning, avoid trades when losing.",
    difficulty: 38,
  },

  // ---------------- kpk-endgame (difficulty 40-55) ----------------
  {
    id: "ex-kpk-1",
    conceptId: "kpk-endgame",
    kind: "find-move",
    fen: "8/8/8/8/3P4/8/1k6/4K3 w - - 0 1",
    prompt: "White to move. Can the pawn outrun the black king? Play the right move.",
    solutionUci: ["d4d5"],
    hints: [
      "Use the square rule: draw the square d4-d8-h8-h4. Is the black king on b2 inside it?",
      "b2 is outside the square (files a-c are outside), so the pawn queens with correct play.",
      "Play 1. d5. The pawn cannot be caught; push it confidently.",
    ],
    explanation:
      "1. d5! The square rule proves the pawn queens: the black king on b2 stands outside the d4-d8-h8-h4 square, so it cannot intercept. In pawn races, count with the square instead of guessing.",
    difficulty: 42,
  },
  {
    id: "ex-kpk-2",
    conceptId: "kpk-endgame",
    kind: "find-move",
    fen: "8/8/8/3kP3/8/3K4/8/8 w - - 0 1",
    prompt: "White to move. Take the opposition and win.",
    solutionUci: ["d3e3"],
    hints: [
      "The kings are on d3 and d5 with White to move. Take the diagonal opposition.",
      "Ke3! mirrors the black king: whatever square it takes, you take the opposition.",
      "Play 1. Ke3! After 1...Kd6 2. Kf4 the white king escorts the pawn home.",
    ],
    explanation:
      "1. Ke3! takes the diagonal opposition: the kings stand a knight's move apart and Black must give way. With the opposition, White's king penetrates (Kf4, Ke5) and the e-pawn queens. Opposition is the steering wheel of king-and-pawn endings.",
    difficulty: 50,
  },
  {
    id: "ex-kpk-3",
    conceptId: "kpk-endgame",
    kind: "choose-move",
    fen: "8/8/8/8/3P4/8/3K4/6k1 w - - 0 1",
    prompt: "White to move. The pawn can outrun the king. Prove it.",
    solutionUci: ["d4d5"],
    choices: ["d4d5", "d2d3", "d2c3", "d2e3"],
    hints: [
      "Apply the square rule from d4 to d8. Where is the black king on g1?",
      "g1 is far outside the square. The pawn promotes.",
      "Play 1. d5. King moves waste the winning tempo; the pawn is the plan.",
    ],
    explanation:
      "1. d5! The black king on g1 is miles outside the promotion square, so the pawn queens by force. King moves like Kd3 would be aimless; in won pawn endings, push the passer and let the king follow.",
    difficulty: 44,
  },
  {
    id: "ex-kpk-4",
    conceptId: "kpk-endgame",
    kind: "yes-no",
    fen: "8/8/8/8/4k3/8/4K3/8 w - - 0 1",
    prompt: "White to move, kings on e2 and e4 with one square between. Does White have the opposition?",
    solutionUci: ["no"],
    hints: [
      "The opposition belongs to the side NOT to move when the kings face off.",
      "White is to move, so White must step aside; Black keeps the opposition.",
      "No. Black has it. Remember: opposition is for the player who does not have to move.",
    ],
    explanation:
      "No. With the kings on e2 and e4 and White to move, the opposition belongs to Black: White must move the king aside and Black takes the key squares. This one-tempo distinction decides countless pawn endings.",
    difficulty: 46,
  },

  // ---------------- rook-endgame (difficulty 45-60) ----------------
  {
    id: "ex-re-1",
    conceptId: "rook-endgame",
    kind: "find-move",
    fen: "6k1/5ppp/8/8/8/8/1R3PPP/6K1 w - - 0 1",
    prompt: "White to move. Put your rook on its most powerful rank.",
    solutionUci: ["b2b7"],
    hints: [
      "Rooks dream of the seventh rank, attacking pawns and bottling up the king.",
      "Rb7 hits f7 and cannot easily be chased away.",
      "Play 1. Rb7. Seventh-rank rooks are worth nearly a pawn of extra activity.",
    ],
    explanation:
      "1. Rb7! seizes the seventh rank: the rook attacks f7, restricts the black king, and will soon double or invade. In rook endings, activity is everything; a rook on the seventh is the definition of active.",
    difficulty: 46,
  },
  {
    id: "ex-re-2",
    conceptId: "rook-endgame",
    kind: "find-move",
    fen: "k7/8/1K6/8/8/8/8/7R w - - 0 1",
    prompt: "White to move. Finish with the classic rook-and-king mate.",
    solutionUci: ["h1h8"],
    hints: [
      "Drive the king to the edge, then deliver mate with the rook while your king covers escapes.",
      "Rh8+ checks; the white king on b6 covers a7 and b7.",
      "Play 1. Rh8#. The king covers a7/b7 and the rook covers the 8th rank: textbook.",
    ],
    explanation:
      "1. Rh8# is the model rook-and-king mate: the rook delivers check along the back rank while the white king on b6 covers a7 and b7. Learn this shape cold; every rook ending can reduce to it.",
    difficulty: 48,
  },
  {
    id: "ex-re-3",
    conceptId: "rook-endgame",
    kind: "choose-move",
    fen: "6k1/5P2/5K2/8/8/8/1r6/6R1 w - - 0 1",
    prompt: "White is winning (Lucena position). Build the bridge.",
    solutionUci: ["g1g4"],
    choices: ["g1g4", "g1g2", "g1f1", "f6e6"],
    hints: [
      "The Lucena technique: get the rook to the fourth rank to shield your king from checks.",
      "Rg4 heads for the fourth rank, the bridge square.",
      "Play 1. Rg4! Then the king walks out (Kf5-g4-h3...) behind the rook's shield and the pawn queens.",
    ],
    explanation:
      "1. Rg4! begins the Lucena bridge: the rook takes up its shielding post on the fourth rank so the white king can emerge from behind the pawn without being checked forever. Memorize the shape: rook on the fourth, king steps out, pawn promotes.",
    difficulty: 58,
  },
  {
    id: "ex-re-4",
    conceptId: "rook-endgame",
    kind: "yes-no",
    fen: "1r4k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1",
    prompt: "Black's rook controls the open b-file. Is Black's rook well placed?",
    solutionUci: ["yes"],
    hints: [
      "Rooks belong on open files. Is the b-file open, and does the rook do anything there?",
      "Yes: it pressures b2 and keeps White tied down.",
      "Yes. An active rook on an open file is exactly where it should be.",
    ],
    explanation:
      "Yes. The rook on the open b-file is ideally placed: it attacks along the file and restricts White. In rook endings, rook activity is usually worth more than a pawn; never trade your active rook for a passive one without reason.",
    difficulty: 46,
  },

  // ---------------- decisions (difficulty 60-80) ----------------
  {
    id: "ex-dec-1",
    conceptId: "decisions",
    kind: "find-move",
    fen: "5rk1/6pp/8/8/8/2N5/6PP/5RK1 w - - 0 1",
    prompt: "White is a piece up. Make the practical decision.",
    solutionUci: ["f1f8"],
    hints: [
      "When ahead, what should you trade? The rooks can come off here.",
      "Rxf8+ forces Kxf8, leaving White a clean piece up with no counterplay.",
      "Play 1. Rxf8+. Simplification is the technique of the already-won game.",
    ],
    explanation:
      "1. Rxf8+! trades the last pair of rooks (1...Kxf8 forced) and leaves White a piece up in a dead position. The practical decision is the safe one: remove Black's only active piece and the win plays itself.",
    difficulty: 62,
  },
  {
    id: "ex-dec-2",
    conceptId: "decisions",
    kind: "find-move",
    fen: "r5k1/5ppp/8/8/3p4/8/5PPP/R5K1 w - - 0 1",
    prompt: "White is a pawn down. Do not simplify: keep counterplay.",
    solutionUci: ["a1a4"],
    acceptableUci: [["a1a7"]],
    hints: [
      "Trading rooks now would just lose cleanly. How can the rook stay active and create problems?",
      "Ra4 attacks the d4 pawn while keeping both rooks on the board.",
      "Play 1. Ra4 (1. Ra7 is similar). When worse, activity and complications are the plan.",
    ],
    explanation:
      "1. Ra4 keeps the rooks on and attacks the advanced d-pawn, setting Black real problems. 1. Rxa8+? would simplify into a lost pawn endgame. When behind, the practical rule flips: avoid trades, seek counterplay.",
    difficulty: 68,
  },
  {
    id: "ex-dec-3",
    conceptId: "decisions",
    kind: "choose-move",
    fen: "3q2k1/5ppp/8/8/8/2N5/5PPP/3Q2K1 w - - 0 1",
    prompt: "White is a piece up. Choose the most practical winning move.",
    solutionUci: ["d1d8"],
    choices: ["d1d8", "c3d5", "d1h5", "f2f4"],
    hints: [
      "A piece up with queens on: what trade ends all resistance?",
      "Qxd8+ forces the queens off and leaves a trivially won endgame.",
      "Play 1. Qxd8+. Take the safe win; the adventures (Qh5, Nd5) only add risk.",
    ],
    explanation:
      "1. Qxd8+ is the practical choice: after 1...Rxd8 White is a piece up with no queens and no counterplay. Winning technique is the art of the safe, slightly boring move. Save the brilliancies for equal positions.",
    difficulty: 64,
  },
  {
    id: "ex-dec-4",
    conceptId: "decisions",
    kind: "yes-no",
    fen: "5rk1/6pp/8/8/8/2N5/6PP/5RK1 w - - 0 1",
    prompt: "White is a piece up. Is trading rooks the right practical decision?",
    solutionUci: ["yes"],
    hints: [
      "Apply the rule: when ahead, trade pieces, not pawns.",
      "Rxf8+ removes Black's only active piece.",
      "Yes. Simplification converts the advantage with minimum risk.",
    ],
    explanation:
      "Yes. 1. Rxf8+ follows the golden practical rule: the player who is ahead trades pieces. Every exchange shrinks Black's counterplay and White's blunder surface. Make it a reflex.",
    difficulty: 60,
  },
];

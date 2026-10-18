-- ai-chess-tutor schema v1
-- Applied once at startup (tracked in meta). Keep additive; never edit applied migrations.

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  display_name TEXT NOT NULL DEFAULT 'Player',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mastery (
  concept_id TEXT PRIMARY KEY,
  mastery REAL NOT NULL DEFAULT 0.2,
  attempts INTEGER NOT NULL DEFAULT 0,
  independent_successes INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_seen_at TEXT,
  next_review_at TEXT
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  concept_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  content_md TEXT NOT NULL,
  exercise_ids TEXT NOT NULL -- JSON array
);

CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  concept_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  fen TEXT NOT NULL,
  prompt TEXT NOT NULL,
  solution_uci TEXT NOT NULL,    -- JSON array of UCI strings
  acceptable_uci TEXT,           -- JSON array of arrays
  choices TEXT,                 -- JSON array (choose-move)
  hints TEXT NOT NULL,          -- JSON array of 3 strings
  explanation TEXT NOT NULL,
  difficulty REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS puzzles (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  fen TEXT NOT NULL,
  solution_uci TEXT NOT NULL,   -- JSON array of UCI strings
  rating REAL NOT NULL,
  themes TEXT NOT NULL          -- JSON array
);

CREATE TABLE IF NOT EXISTS exercise_attempts (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL,
  session_id TEXT,
  outcome TEXT NOT NULL,        -- independent | hinted | shown
  hints_used INTEGER NOT NULL DEFAULT 0,
  time_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ex_attempts_ex ON exercise_attempts(exercise_id);

CREATE TABLE IF NOT EXISTS puzzle_attempts (
  id TEXT PRIMARY KEY,
  puzzle_id TEXT NOT NULL,
  solved INTEGER NOT NULL,      -- 0/1
  hints_used INTEGER NOT NULL DEFAULT 0,
  time_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pz_attempts_pz ON puzzle_attempts(puzzle_id);

CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  items TEXT NOT NULL           -- JSON array of {exerciseId, conceptId, difficulty}
);

CREATE TABLE IF NOT EXISTS assessment_answers (
  assessment_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  hints_used INTEGER NOT NULL DEFAULT 0,
  time_ms INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (assessment_id, exercise_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  minutes INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  status TEXT NOT NULL,         -- active | paused | completed
  plan TEXT NOT NULL,           -- JSON array of SessionStep
  completed_steps TEXT NOT NULL -- JSON array of numbers
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  white TEXT NOT NULL,
  black TEXT NOT NULL,
  result TEXT NOT NULL,
  pgn TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  analyzed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS game_moves (
  game_id TEXT NOT NULL,
  ply INTEGER NOT NULL,
  san TEXT NOT NULL,
  uci TEXT NOT NULL,
  fen_before TEXT NOT NULL,
  eval_cp REAL,
  cp_loss REAL,
  classification TEXT NOT NULL DEFAULT 'unanalyzed',
  concept_links TEXT NOT NULL DEFAULT '[]',  -- JSON array of {conceptId, confidence}
  PRIMARY KEY (game_id, ply)
);

CREATE TABLE IF NOT EXISTS tutor_messages (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,           -- user | assistant
  content TEXT NOT NULL,
  fen TEXT,
  created_at TEXT NOT NULL
);

-- Daily snapshots of average mastery for the trend chart.
CREATE TABLE IF NOT EXISTS mastery_snapshots (
  day TEXT PRIMARY KEY,         -- YYYY-MM-DD
  avg_mastery REAL NOT NULL
);

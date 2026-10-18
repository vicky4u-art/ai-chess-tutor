/** Game import + engine analysis + mistake classification. */
import { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { GameMove, ImportedGame } from '@chesstutor/shared';
import { conceptName } from '../chess/conceptNames';
import { api, ChessApiError, EngineEval, GameDetail } from '../api';
import { engine } from '../chess/engine';
import { ChessboardView } from '../components/Chessboard';
import { useChessGame } from '../chess/useChessGame';
import { Btn, Card, ErrorBox, Loading, SectionTitle } from '../components/ui';

const CLASS_COLORS: Record<GameMove['classification'], string> = {
  best: 'text-emerald-300',
  good: 'text-slate-300',
  inaccuracy: 'text-amber-300',
  mistake: 'text-orange-400',
  blunder: 'text-red-400',
  book: 'text-sky-300',
  unanalyzed: 'text-slate-500',
};

function whitePerspectiveCp(move: GameMove): number | null {
  if (move.evalCp === null) return null;
  try {
    const turn = new Chess(move.fenBefore).turn();
    return turn === 'w' ? move.evalCp : -move.evalCp;
  } catch {
    return move.evalCp;
  }
}

function EvalBar({ cp }: { cp: number | null }) {
  if (cp === null) return <div className="h-2 rounded bg-slate-800" />;
  const clamped = Math.max(-600, Math.min(600, cp));
  const whiteShare = 50 + (clamped / 600) * 50;
  return (
    <div className="h-2 rounded bg-slate-700 overflow-hidden">
      <div className="h-full bg-slate-100" style={{ width: `${whiteShare}%` }} />
    </div>
  );
}

export function Analyze() {
  const [games, setGames] = useState<ImportedGame[] | null>(null);
  const [detail, setDetail] = useState<GameDetail | null>(null);
  const [pgn, setPgn] = useState('');
  const [ccUser, setCcUser] = useState('');
  const [ccImporting, setCcImporting] = useState(false);
  const [ccMsg, setCcMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [engineError, setEngineError] = useState<string | null>(null);
  const game = useChessGame();
  const cancelRef = useRef(false);

  useEffect(() => {
    api.listGames().then(setGames).catch(() => setGames([]));
  }, []);

  const openGame = async (id: string) => {
    setError(null);
    try {
      const d = await api.getGame(id);
      setDetail(d);
      game.loadPgn(d.pgn);
    } catch (e) {
      setError(e instanceof ChessApiError ? e.message : 'Could not open the game.');
    }
  };

  const doChesscomImport = async () => {
    if (!ccUser.trim()) return;
    setCcImporting(true);
    setError(null);
    setCcMsg(null);
    try {
      const r = await api.importChesscom({ username: ccUser.trim(), maxGames: 30 });
      setCcMsg(
        r.imported > 0
          ? `Imported ${r.imported} game${r.imported === 1 ? '' : 's'} from ${r.username}${r.skipped ? ` (${r.skipped} already imported)` : ''}.`
          : r.skipped > 0
            ? `No new games — ${r.skipped} already imported from ${r.username}.`
            : `No games found for ${r.username}.`,
      );
      const list = await api.listGames().catch(() => null);
      if (list) setGames(list);
    } catch (e) {
      setError(e instanceof ChessApiError ? e.message : 'Chess.com import failed.');
    } finally {
      setCcImporting(false);
    }
  };

  const doImport = async () => {
    if (!pgn.trim()) return;
    setImporting(true);
    setError(null);
    try {
      const d = await api.importGame(pgn.trim());
      setDetail(d);
      game.loadPgn(d.pgn);
      setPgn('');
      const list = await api.listGames().catch(() => null);
      if (list) setGames(list);
    } catch (e) {
      setError(e instanceof ChessApiError ? e.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setPgn(String(r.result ?? ''));
    r.readAsText(f);
  };

  const runAnalysis = async () => {
    if (!detail || analyzing) return;
    setEngineError(null);
    setAnalyzing(true);
    setAnalyzeProgress(0);
    cancelRef.current = false;
    try {
      await engine.init();
    } catch (e) {
      setEngineError((e as Error).message);
      setAnalyzing(false);
      return;
    }
    const evals: EngineEval[] = [];
    const moves = detail.moves;
    for (let i = 0; i < moves.length; i++) {
      if (cancelRef.current) break;
      const m = moves[i];
      const a = await engine.analyze(m.fenBefore, { depth: 14, timeMs: 500 });
      if (a) evals.push({ ply: m.ply, evalCp: a.evalCp, bestUci: a.bestUci, depth: a.depth });
      setAnalyzeProgress(Math.round(((i + 1) / moves.length) * 100));
    }
    if (!cancelRef.current && evals.length > 0) {
      try {
        const res = await api.analyzeGame(detail.game.id, evals);
        setDetail({ ...detail, moves: res.moves, game: { ...detail.game, analyzed: true } });
      } catch (e) {
        setEngineError(e instanceof ChessApiError ? e.message : 'Server analysis failed.');
      }
    }
    setAnalyzing(false);
  };

  const currentMove: GameMove | null =
    detail && game.displayPly > 0 ? detail.moves[game.displayPly - 1] ?? null : null;

  // ---- game view ----
  if (detail) {
    return (
      <div className="p-4 pb-24 space-y-4">
        <Btn variant="ghost" onClick={() => setDetail(null)}>← Games</Btn>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            {detail.game.white} vs {detail.game.black}
          </h2>
          <p className="text-sm text-slate-400">Result: {detail.game.result}</p>
        </div>

        <div className="flex justify-center">
          <ChessboardView
            id="analyze-board"
            fen={game.fen}
            allowMoves={false}
            lastMove={
              game.displayPly > 0 && detail.moves[game.displayPly - 1]
                ? {
                    from: detail.moves[game.displayPly - 1].uci.slice(0, 2),
                    to: detail.moves[game.displayPly - 1].uci.slice(2, 4),
                  }
                : null
            }
          />
        </div>

        <Card>
          <div className="flex gap-1 mb-2">
            <Btn variant="subtle" onClick={game.gotoStart}>|◀</Btn>
            <Btn variant="subtle" onClick={game.stepBack}>◀</Btn>
            <Btn variant="subtle" onClick={game.stepForward}>▶</Btn>
            <Btn variant="subtle" onClick={game.gotoEnd}>▶|</Btn>
            <span className="ml-auto text-sm text-slate-400 self-center tabular-nums">
              {game.displayPly}/{detail.moves.length}
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto grid grid-cols-1 gap-0.5">
            {detail.moves.map((m, i) => (
              <button
                key={m.ply}
                onClick={() => game.gotoPly(i + 1)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-left min-h-[36px] hover:bg-slate-800 ${
                  game.displayPly === i + 1 ? 'bg-slate-800' : ''
                }`}
              >
                <span className="text-slate-500 text-xs w-8 tabular-nums">{m.ply}.</span>
                <span className={`text-sm font-medium ${CLASS_COLORS[m.classification]}`}>{m.san}</span>
                {m.cpLoss !== null && m.cpLoss > 0 && (
                  <span className="text-xs text-slate-500 tabular-nums">−{m.cpLoss}</span>
                )}
                <span className="ml-auto text-[11px] text-slate-500 capitalize">{m.classification}</span>
              </button>
            ))}
          </div>
        </Card>

        {currentMove && (
          <Card>
            <SectionTitle>Move {currentMove.ply}: {currentMove.san}</SectionTitle>
            <EvalBar cp={whitePerspectiveCp(currentMove)} />
            <p className="text-xs text-slate-500 mt-1 mb-2">
              Eval {currentMove.evalCp === null ? '—' : (whitePerspectiveCp(currentMove)! / 100).toFixed(2)} (white's perspective)
              {currentMove.cpLoss !== null && currentMove.cpLoss > 0 && ` · lost ${currentMove.cpLoss} cp`}
            </p>
            {currentMove.conceptLinks.length > 0 ? (
              <ul className="space-y-1">
                {currentMove.conceptLinks.map((l) => (
                  <li key={l.conceptId} className="text-sm text-slate-300">
                    {conceptName(l.conceptId)}{' '}
                    <span className={`text-xs ${l.confidence >= 0.7 ? 'text-amber-300' : 'text-slate-500'}`}>
                      ({l.confidence >= 0.7 ? 'likely' : 'uncertain'})
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No concept link assigned.</p>
            )}
          </Card>
        )}

        <Card>
          <SectionTitle>Engine analysis</SectionTitle>
          {analyzing ? (
            <div>
              <p className="text-sm text-slate-300 mb-2">Analyzing… {analyzeProgress}%</p>
              <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden mb-3">
                <div className="h-full bg-amber-400 transition-all" style={{ width: `${analyzeProgress}%` }} />
              </div>
              <Btn variant="danger" onClick={() => (cancelRef.current = true)}>Cancel</Btn>
            </div>
          ) : (
            <Btn onClick={runAnalysis} disabled={detail.moves.length === 0}>
              {detail.game.analyzed ? 'Re-analyze with engine' : 'Analyze with engine'}
            </Btn>
          )}
          {engineError && <p className="text-red-300 text-sm mt-2">{engineError}</p>}
        </Card>
      </div>
    );
  }

  // ---- import view ----
  return (
    <div className="p-4 pb-24 space-y-4">
      <SectionTitle>Analyze your games</SectionTitle>
      {error && <ErrorBox message={error} />}
      <Card>
        <SectionTitle>Sync from Chess.com</SectionTitle>
        <p className="text-sm text-slate-400 mb-3">
          Pull your recent games straight from Chess.com — no PGN files needed.
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            value={ccUser}
            onChange={(e) => setCcUser(e.target.value)}
            placeholder="Chess.com username"
            autoCapitalize="none"
            autoCorrect="off"
            className="flex-1 min-w-[160px] bg-slate-950 border border-slate-800 rounded-xl p-3 text-[15px] text-slate-200"
          />
          <Btn onClick={doChesscomImport} disabled={ccImporting || !ccUser.trim()}>
            {ccImporting ? 'Syncing…' : 'Import last 30'}
          </Btn>
        </div>
        {ccMsg && <p className="text-sm text-emerald-300 mt-2">{ccMsg}</p>}
      </Card>
      <Card>
        <SectionTitle>Paste PGN</SectionTitle>
        <textarea
          value={pgn}
          onChange={(e) => setPgn(e.target.value)}
          placeholder={'1. e4 e5 2. Nf3 …'}
          className="w-full h-36 bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 font-mono"
        />
        <div className="flex gap-2 mt-3 flex-wrap">
          <Btn onClick={doImport} disabled={importing || !pgn.trim()}>
            {importing ? 'Importing…' : 'Import game'}
          </Btn>
          <label className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-700 text-slate-200 text-[15px] font-medium cursor-pointer inline-flex items-center">
            Upload file
            <input type="file" accept=".pgn,.txt" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </div>
      </Card>

      <SectionTitle>Imported games</SectionTitle>
      {!games && <Loading label="Loading games" />}
      {games && games.length === 0 && <p className="text-sm text-slate-500">No games imported yet.</p>}
      <div className="space-y-2">
        {(games ?? []).map((g) => (
          <button
            key={g.id}
            onClick={() => openGame(g.id)}
            className="w-full text-left bg-slate-900 border border-slate-800 rounded-2xl p-4 min-h-[64px] hover:border-slate-600"
          >
            <p className="text-slate-100 font-medium">{g.white} vs {g.black}</p>
            <p className="text-sm text-slate-400">
              {g.result} · {g.moveCount} moves · {g.analyzed ? 'analyzed' : 'not analyzed'}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

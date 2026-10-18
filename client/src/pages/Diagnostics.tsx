/** Diagnostics: versions, engine probe, scratch board state, export. */
import { useState } from 'react';
import { api, ChessApiError, Diagnostics as DiagInfo } from '../api';
import { engine } from '../chess/engine';
import { ChessboardView } from '../components/Chessboard';
import { useChessGame } from '../chess/useChessGame';
import { Btn, Card, ErrorBox, Loading, SectionTitle } from '../components/ui';

export function Diagnostics() {
  const [info, setInfo] = useState<DiagInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [engineStatus, setEngineStatus] = useState<'idle' | 'probing' | 'ok' | 'unavailable'>('idle');
  const [engineDetail, setEngineDetail] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const game = useChessGame();

  const load = async () => {
    setError(null);
    try {
      setInfo(await api.diagnostics());
    } catch (e) {
      setError(e instanceof ChessApiError ? e.message : 'Could not reach the server.');
    }
  };

  const probeEngine = async () => {
    setEngineStatus('probing');
    setEngineDetail('');
    try {
      await engine.init();
      const a = await engine.analyze('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', {
        depth: 8,
        timeMs: 400,
      });
      if (a) {
        setEngineStatus('ok');
        setEngineDetail(`depth ${a.depth}, best ${a.bestUci}, eval ${(a.evalCp / 100).toFixed(2)}`);
      } else {
        setEngineStatus('unavailable');
        setEngineDetail('Engine started but returned no analysis.');
      }
    } catch (e) {
      setEngineStatus('unavailable');
      setEngineDetail((e as Error).message);
    }
  };

  const doExport = async () => {
    setExporting(true);
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chess-tutor-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof ChessApiError ? e.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4 pb-24 space-y-4">
      <SectionTitle>Diagnostics</SectionTitle>
      {error && <ErrorBox message={error} onRetry={load} />}

      <Card>
        <SectionTitle>Server</SectionTitle>
        {!info && !error && (
          <Btn variant="ghost" onClick={load}>
            Check server
          </Btn>
        )}
        {info && (
          <dl className="text-sm space-y-1">
            <div className="flex justify-between"><dt className="text-slate-400">Version</dt><dd className="text-slate-200 font-mono">{info.version}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">AI configured</dt><dd className={info.aiConfigured ? 'text-emerald-300' : 'text-amber-300'}>{info.aiConfigured ? 'yes' : 'no'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Server time</dt><dd className="text-slate-200 font-mono">{new Date(info.serverTime).toLocaleString()}</dd></div>
          </dl>
        )}
      </Card>

      <Card>
        <SectionTitle>Chess engine</SectionTitle>
        <div className="flex items-center gap-3 flex-wrap">
          <Btn variant="ghost" onClick={probeEngine} disabled={engineStatus === 'probing'}>
            {engineStatus === 'probing' ? 'Probing…' : 'Probe engine'}
          </Btn>
          {engineStatus === 'ok' && <span className="text-emerald-300 text-sm">Available</span>}
          {engineStatus === 'unavailable' && <span className="text-red-300 text-sm">Unavailable</span>}
        </div>
        {engineDetail && <p className="text-xs text-slate-400 mt-2 break-words">{engineDetail}</p>}
      </Card>

      <Card>
        <SectionTitle>Scratch board</SectionTitle>
        <div className="flex justify-center mb-2">
          <ChessboardView
            id="diag-board"
            fen={game.fen}
            onMove={(from, to, promotion) => game.move(from, to, promotion)}
          />
        </div>
        <p className="text-[11px] text-slate-500 font-mono break-all mb-1">{game.liveFen}</p>
        <p className="text-[11px] text-slate-500 font-mono break-all">
          Moves: {game.history.map((m) => m.san).join(' ') || '—'}
        </p>
        <div className="flex gap-2 mt-2">
          <Btn variant="subtle" onClick={game.undo}>Undo</Btn>
          <Btn variant="subtle" onClick={game.reset}>Reset</Btn>
        </div>
      </Card>

      <Card>
        <SectionTitle>Export</SectionTitle>
        <p className="text-sm text-slate-400 mb-3">
          Download all learning data (profile, mastery, history, games) as JSON. No secrets included.
        </p>
        <Btn onClick={doExport} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export my data'}
        </Btn>
      </Card>

      {!info && <Loading label="Tip: tap “Check server” above" />}
    </div>
  );
}

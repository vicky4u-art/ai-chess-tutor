/** Progress dashboard: concept mastery, strengths/weaknesses, reviews, trends. */
import { useEffect, useState } from 'react';
import type { DashboardData } from '@chesstutor/shared';
import { conceptName } from '../chess/conceptNames';
import { api, ChessApiError } from '../api';
import { Btn, Card, ConceptBar, ErrorBox, Loading, SectionTitle } from '../components/ui';

function Sparkline({ points }: { points: { date: string; avgMastery: number }[] }) {
  if (points.length < 2) return <p className="text-sm text-slate-500">Not enough history yet.</p>;
  const w = 280;
  const h = 64;
  const min = Math.min(...points.map((p) => p.avgMastery));
  const max = Math.max(...points.map((p) => p.avgMastery));
  const span = Math.max(0.01, max - min);
  const coords = points
    .map((p, i) => `${(i / (points.length - 1)) * w},${h - 6 - ((p.avgMastery - min) / span) * (h - 14)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[320px]" role="img" aria-label="Mastery trend">
      <polyline points={coords} fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle
          key={p.date}
          cx={(i / (points.length - 1)) * w}
          cy={h - 6 - ((p.avgMastery - min) / span) * (h - 14)}
          r="3"
          fill="#fbbf24"
        />
      ))}
    </svg>
  );
}

export function Dashboard({ onStartSession }: { onStartSession: (sessionId: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(20);
  const [starting, setStarting] = useState(false);

  const load = () => {
    setError(null);
    api
      .getProgress()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof ChessApiError ? e.message : 'Failed to load progress.'));
  };

  useEffect(load, []);

  const start = async () => {
    setStarting(true);
    try {
      const session = await api.startSession(minutes);
      onStartSession(session.id);
    } catch (e) {
      setError(e instanceof ChessApiError ? e.message : 'Could not start a session.');
      setStarting(false);
    }
  };

  if (error && !data) return <div className="p-4"><ErrorBox message={error} onRetry={load} /></div>;
  if (!data) return <div className="p-4"><Loading label="Loading your progress" /></div>;

  const sorted = [...data.concepts].sort((a, b) => b.mastery - a.mastery);

  return (
    <div className="p-4 space-y-4 pb-24">
      <Card>
        <SectionTitle>Daily lesson</SectionTitle>
        <p className="text-sm text-slate-400 mb-3">
          A personalized {minutes}-minute session: review, instruction, exercises.
        </p>
        <div className="flex gap-2 mb-3">
          {[10, 20, 30].map((m) => (
            <button
              key={m}
              onClick={() => setMinutes(m)}
              className={`min-h-[44px] px-4 rounded-xl border text-sm font-medium ${
                minutes === m ? 'bg-amber-400 text-slate-950 border-amber-400' : 'border-slate-700 text-slate-300'
              }`}
            >
              {m} min
            </button>
          ))}
        </div>
        <Btn onClick={start} disabled={starting} className="w-full">
          {starting ? 'Starting…' : 'Start daily lesson'}
        </Btn>
        {error && <p className="text-red-300 text-sm mt-2">{error}</p>}
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <p className="text-2xl font-semibold text-amber-300 tabular-nums">{Math.round(data.accuracyIndependent * 100)}%</p>
          <p className="text-xs text-slate-400">accuracy, no hints</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-semibold text-amber-300 tabular-nums">{data.reviewsDue}</p>
          <p className="text-xs text-slate-400">reviews due</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-semibold text-amber-300 tabular-nums">{data.recentSessions.length}</p>
          <p className="text-xs text-slate-400">recent sessions</p>
        </Card>
      </div>

      <Card>
        <SectionTitle>Skill profile</SectionTitle>
        {sorted.map((c) => (
          <ConceptBar key={c.conceptId} name={c.name} value={c.mastery} />
        ))}
        <div className="mt-3 text-sm">
          {data.strongest.length > 0 && (
            <p className="text-slate-300 mb-1">
              <span className="text-emerald-300 font-medium">Strongest:</span>{' '}
              {data.strongest.map(conceptName).join(', ')}
            </p>
          )}
          {data.weakest.length > 0 && (
            <p className="text-slate-300">
              <span className="text-red-300 font-medium">Needs work:</span>{' '}
              {data.weakest.map(conceptName).join(', ')}
            </p>
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle>Mastery trend</SectionTitle>
        <Sparkline points={data.masteryTrend} />
      </Card>

      {data.recurringMistakes.length > 0 && (
        <Card>
          <SectionTitle>Recurring mistakes in your games</SectionTitle>
          <ul className="space-y-1 text-sm text-slate-300">
            {data.recurringMistakes.map((m) => (
              <li key={m.conceptId}>
                {conceptName(m.conceptId)} — <span className="text-slate-400">{m.count} times</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.nextPriorities.length > 0 && (
        <Card>
          <SectionTitle>Recommended next</SectionTitle>
          <ul className="space-y-2">
            {data.nextPriorities.map((p) => (
              <li key={p.conceptId} className="text-sm">
                <span className="text-slate-100 font-medium">{conceptName(p.conceptId)}</span>
                <span className="text-slate-400"> — {p.reason}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.recentSessions.length > 0 && (
        <Card>
          <SectionTitle>Recent sessions</SectionTitle>
          <ul className="space-y-1 text-sm text-slate-300">
            {data.recentSessions.slice(0, 5).map((s) => (
              <li key={s.id} className="flex justify-between">
                <span>{s.minutes} min · {new Date(s.startedAt).toLocaleDateString()}</span>
                <span className="text-slate-400">{s.stepsDone}/{s.stepsTotal} steps · {s.status}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

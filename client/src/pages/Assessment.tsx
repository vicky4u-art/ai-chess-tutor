/** Adaptive skill assessment: ~10-15 positions, per-concept profile. */
import { useCallback, useEffect, useState } from 'react';
import type { AssessmentResult, ConceptId, Exercise } from '@chesstutor/shared';
import { conceptName } from '../chess/conceptNames';
import { api, AssessmentStart, ChessApiError } from '../api';
import { ExerciseRunner, AttemptResult } from '../components/ExerciseRunner';
import { Btn, Card, ConceptBar, ErrorBox, Loading, SectionTitle } from '../components/ui';

type Phase = 'intro' | 'running' | 'finishing' | 'done';

export function Assessment() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [start, setStart] = useState<AssessmentStart | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);

  const begin = useCallback(() => {
    setError(null);
    setPhase('running');
    api
      .startAssessment()
      .then((s) => {
        setStart(s);
        setIndex(0);
      })
      .catch((e: unknown) => {
        setError(e instanceof ChessApiError ? e.message : 'Could not start the assessment.');
        setPhase('intro');
      });
  }, []);

  useEffect(() => {
    // nothing on mount; user starts explicitly
  }, []);

  const current: Exercise | null =
    start && index < start.exercises.length ? start.exercises[index] : null;

  const handleDone = async (r: AttemptResult) => {
    if (!start || !current) return;
    try {
      await api.answerAssessment({
        assessmentId: start.assessmentId,
        exerciseId: current.id,
        outcome: r.outcome,
        timeMs: r.timeMs,
        hintsUsed: r.hintsUsed,
        playedUci: r.playedUci,
      });
    } catch (e) {
      // Record locally and continue; the finish call carries the summary.
      console.warn('[assessment] answer post failed:', e);
    }
    const next = index + 1;
    if (start && next >= start.exercises.length) {
      setPhase('finishing');
      try {
        const res = await api.finishAssessment(start.assessmentId);
        setResult(res);
        setPhase('done');
      } catch (e) {
        setError(e instanceof ChessApiError ? e.message : 'Could not finish the assessment.');
        setPhase('running');
      }
    } else {
      setIndex(next);
    }
  };

  if (phase === 'intro') {
    return (
      <div className="p-4 pb-24 space-y-4">
        <Card>
          <SectionTitle>Skill assessment</SectionTitle>
          <p className="text-sm text-slate-300 leading-relaxed mb-2">
            About 10–15 positions covering tactics, checkmates, endgames, openings and
            calculation. Difficulty adapts as you go.
          </p>
          <p className="text-sm text-slate-400 leading-relaxed mb-4">
            This builds your starting skill profile — it is not an exact Elo rating.
            You can skip it or retake it any time.
          </p>
          {error && <p className="text-red-300 text-sm mb-3">{error}</p>}
          <div className="flex gap-2">
            <Btn onClick={begin} className="flex-1">Start assessment</Btn>
            <Btn variant="ghost" onClick={() => (window.location.hash = '#/dashboard')}>Skip</Btn>
          </div>
        </Card>
      </div>
    );
  }

  if (phase === 'finishing') {
    return <div className="p-4"><Loading label="Scoring your assessment" /></div>;
  }

  if (phase === 'done' && result) {
    const uncertain = new Set<ConceptId>(result.uncertain);
    const sorted = [...result.profile].sort((a, b) => b.mastery - a.mastery);
    return (
      <div className="p-4 pb-24 space-y-4">
        <Card>
          <SectionTitle>Your skill profile</SectionTitle>
          <p className="text-xs text-slate-500 mb-2">
            Finished {new Date(result.finishedAt).toLocaleString()}. Concepts marked
            “uncertain” had fewer than 3 data points.
          </p>
          {sorted.map((m) => (
            <ConceptBar
              key={m.conceptId}
              name={conceptName(m.conceptId)}
              value={m.mastery}
              uncertain={uncertain.has(m.conceptId)}
            />
          ))}
          <div className="flex gap-2 mt-4">
            <Btn onClick={begin} className="flex-1">Retake</Btn>
            <Btn variant="ghost" onClick={() => (window.location.hash = '#/dashboard')}>Dashboard</Btn>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return <div className="p-4"><ErrorBox message={error} onRetry={begin} /></div>;
  }
  if (!current) {
    return <div className="p-4"><Loading label="Preparing positions" /></div>;
  }

  return (
    <div className="p-4 pb-24 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Position {index + 1} of {start?.exercises.length ?? '…'}
        </p>
        <p className="text-sm text-slate-400">
          {conceptName(current.conceptId)}
        </p>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-amber-400 transition-all"
          style={{ width: `${((index + 1) / (start?.exercises.length ?? 1)) * 100}%` }}
        />
      </div>
      <ExerciseRunner key={current.id} exercise={current} onDone={handleDone} />
    </div>
  );
}

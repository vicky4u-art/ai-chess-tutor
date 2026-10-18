/** Curriculum browser: concepts -> lessons -> content + exercises. */
import { useEffect, useState } from 'react';
import type { Concept, ConceptId, Lesson } from '@chesstutor/shared';
import { api, ChessApiError, LessonDetail } from '../api';
import { ExerciseRunner, AttemptResult } from '../components/ExerciseRunner';
import { Btn, Card, ErrorBox, Loading, Markdown, SectionTitle } from '../components/ui';

export function Learn({ lessonId, onOpenLesson }: { lessonId?: string; onOpenLesson: (id: string) => void }) {
  const [concepts, setConcepts] = useState<Concept[] | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<ConceptId | null>(null);
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [detail, setDetail] = useState<LessonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [conceptsError, setConceptsError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getConcepts()
      .then(setConcepts)
      .catch((e: unknown) =>
        setConceptsError(e instanceof ChessApiError ? e.message : 'Could not load concepts.'),
      );
  }, []);

  useEffect(() => {
    if (!selectedConcept) {
      setLessons(null);
      return;
    }
    setLessons(null);
    api
      .getLessons(selectedConcept)
      .then(setLessons)
      .catch((e: unknown) => setError(e instanceof ChessApiError ? e.message : 'Could not load lessons.'));
  }, [selectedConcept]);

  useEffect(() => {
    if (!lessonId) {
      setDetail(null);
      return;
    }
    setDetail(null);
    setError(null);
    api
      .getLesson(lessonId)
      .then(setDetail)
      .catch((e: unknown) => setError(e instanceof ChessApiError ? e.message : 'Could not load the lesson.'));
  }, [lessonId]);

  const recordAttempt = (exerciseId: string) => async (r: AttemptResult) => {
    try {
      await api.attemptExercise(exerciseId, {
        outcome: r.outcome,
        timeMs: r.timeMs,
        hintsUsed: r.hintsUsed,
        playedUci: r.playedUci,
      });
    } catch (e) {
      console.warn('[learn] attempt post failed:', e);
    }
  };

  // ---- lesson view ----
  if (lessonId) {
    if (error) return <div className="p-4"><ErrorBox message={error} onRetry={() => onOpenLesson(lessonId)} /></div>;
    if (!detail) return <div className="p-4"><Loading label="Loading lesson" /></div>;
    const { lesson, exercises } = detail;
    return (
      <div className="p-4 pb-24 space-y-4">
        <Btn variant="ghost" onClick={() => onOpenLesson('')} className="self-start">
          ← All lessons
        </Btn>
        <Card>
          <p className="text-xs text-amber-300/80 uppercase tracking-wide mb-1">Level {lesson.level}</p>
          <h1 className="text-xl font-semibold text-slate-100 mb-1">{lesson.title}</h1>
          <p className="text-sm text-slate-400 mb-3">{lesson.objective}</p>
          <Markdown text={lesson.contentMd} />
        </Card>
        <SectionTitle>Practice</SectionTitle>
        {exercises.length === 0 && <p className="text-sm text-slate-500">No exercises in this lesson yet.</p>}
        {exercises.map((ex) => (
          <ExerciseRunner key={ex.id} exercise={ex} onDone={recordAttempt(ex.id)} />
        ))}
      </div>
    );
  }

  // ---- concept + lesson lists ----
  return (
    <div className="p-4 pb-24 space-y-4">
      <SectionTitle>Learn</SectionTitle>
      {conceptsError && <ErrorBox message={conceptsError} onRetry={() => window.location.reload()} />}
      {!concepts && !conceptsError && <Loading label="Loading concepts" />}
      {concepts && !selectedConcept && (
        <div className="space-y-2">
          {concepts.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedConcept(c.id)}
              className="w-full text-left bg-slate-900 border border-slate-800 rounded-2xl p-4 min-h-[64px] hover:border-slate-600"
            >
              <p className="text-slate-100 font-medium">{c.name}</p>
              <p className="text-sm text-slate-400 mt-0.5">{c.blurb}</p>
            </button>
          ))}
        </div>
      )}
      {selectedConcept && (
        <>
          <Btn variant="ghost" onClick={() => setSelectedConcept(null)}>
            ← Concepts
          </Btn>
          <h2 className="text-lg font-semibold text-slate-100">
            {concepts?.find((c) => c.id === selectedConcept)?.name}
          </h2>
          {error && <ErrorBox message={error} />}
          {!lessons && !error && <Loading label="Loading lessons" />}
          <div className="space-y-2">
            {(lessons ?? []).map((l) => (
              <button
                key={l.id}
                onClick={() => onOpenLesson(l.id)}
                className="w-full text-left bg-slate-900 border border-slate-800 rounded-2xl p-4 min-h-[64px] hover:border-slate-600"
              >
                <p className="text-slate-100 font-medium">
                  <span className="text-amber-300/80 text-sm mr-2">Lv{l.level}</span>
                  {l.title}
                </p>
                <p className="text-sm text-slate-400 mt-0.5">{l.objective}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

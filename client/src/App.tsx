/** Hash-based router + bottom tab navigation (mobile-first). */
import { useEffect, useState } from 'react';
import { Dashboard } from './pages/Dashboard';
import { Assessment } from './pages/Assessment';
import { Learn } from './pages/Learn';
import { Puzzles } from './pages/Puzzles';
import { Analyze } from './pages/Analyze';
import { Tutor } from './pages/Tutor';
import { Diagnostics } from './pages/Diagnostics';
import { Session } from './pages/Session';

type Route =
  | { name: 'dashboard' }
  | { name: 'assessment' }
  | { name: 'learn'; lessonId?: string }
  | { name: 'puzzles' }
  | { name: 'analyze' }
  | { name: 'tutor' }
  | { name: 'diagnostics' }
  | { name: 'session'; sessionId: string };

function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [path, param] = h.split('/');
  switch (path) {
    case 'assessment':
      return { name: 'assessment' };
    case 'learn':
      return { name: 'learn', lessonId: param || undefined };
    case 'puzzles':
      return { name: 'puzzles' };
    case 'analyze':
      return { name: 'analyze' };
    case 'tutor':
      return { name: 'tutor' };
    case 'diagnostics':
      return { name: 'diagnostics' };
    case 'session':
      return param ? { name: 'session', sessionId: param } : { name: 'dashboard' };
    default:
      return { name: 'dashboard' };
  }
}

const TABS: { route: string; label: string }[] = [
  { route: '#/dashboard', label: 'Home' },
  { route: '#/learn', label: 'Learn' },
  { route: '#/puzzles', label: 'Puzzles' },
  { route: '#/analyze', label: 'Analyze' },
  { route: '#/tutor', label: 'Tutor' },
];

function tabFor(route: Route): string {
  switch (route.name) {
    case 'dashboard':
    case 'session':
      return '#/dashboard';
    case 'assessment':
      return '#/dashboard';
    default:
      return `#/${route.name}`;
  }
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash());

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const activeTab = tabFor(route);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur border-b border-slate-800">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">
            <span className="text-amber-400">Chess</span> Tutor
          </h1>
          <button
            onClick={() => (window.location.hash = '#/diagnostics')}
            className="text-xs text-slate-500 hover:text-slate-300 min-h-[44px] px-2"
            aria-label="Diagnostics"
          >
            Diagnostics
          </button>
        </div>
      </header>

      <main>
        {route.name === 'dashboard' && (
          <Dashboard onStartSession={(id) => (window.location.hash = `#/session/${id}`)} />
        )}
        {route.name === 'assessment' && <Assessment />}
        {route.name === 'learn' && (
          <Learn
            lessonId={route.lessonId}
            onOpenLesson={(id) => (window.location.hash = id ? `#/learn/${id}` : '#/learn')}
          />
        )}
        {route.name === 'puzzles' && <Puzzles />}
        {route.name === 'analyze' && <Analyze />}
        {route.name === 'tutor' && <Tutor />}
        {route.name === 'diagnostics' && <Diagnostics />}
        {route.name === 'session' && <Session sessionId={route.sessionId} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-slate-950/95 backdrop-blur border-t border-slate-800">
        <div className="grid grid-cols-5" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {TABS.map((t) => {
            const active = activeTab === t.route;
            return (
              <button
                key={t.route}
                onClick={() => (window.location.hash = t.route)}
                className={`min-h-[60px] flex flex-col items-center justify-center text-[13px] font-medium ${
                  active ? 'text-amber-300' : 'text-slate-400'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

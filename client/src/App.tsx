/** Hash-based router + bottom tab navigation (mobile-first). */
import { useEffect, useState } from 'react';
import { api } from './api';
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
  const [access, setAccess] = useState<'checking' | 'locked' | 'unlocked' | 'error'>('checking');
  const [token, setToken] = useState('');
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.authStatus().then((s) => setAccess(s.authenticated ? 'unlocked' : 'locked'))
      .catch(() => setAccess('error'));
  }, []);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError('');
    setSubmitting(true);
    try {
      await api.login(token);
      setToken('');
      setAccess('unlocked');
    } catch {
      setAuthError('Incorrect token or login unavailable.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const activeTab = tabFor(route);

  if (access !== 'unlocked') {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-5">
        <section className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-4">
          <h1 className="text-xl font-semibold text-amber-300">Chess Tutor</h1>
          {access === 'checking' && <p>Checking access…</p>}
          {access === 'error' && <p>Could not contact the tutor server. Reload to retry.</p>}
          {access === 'locked' && (
            <form onSubmit={signIn} className="space-y-3">
              <p className="text-sm text-slate-300">Enter your private APP_TOKEN to unlock your tutor.</p>
              <input type="password" autoComplete="current-password" aria-label="Access token"
                value={token} onChange={(e) => setToken(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-600 p-3" />
              {authError && <p role="alert" className="text-sm text-red-300">{authError}</p>}
              <button disabled={submitting || !token} className="w-full rounded-lg bg-amber-400 text-slate-950 p-3 font-medium disabled:opacity-50">
                {submitting ? 'Checking…' : 'Unlock tutor'}
              </button>
            </form>
          )}
        </section>
      </main>
    );
  }
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

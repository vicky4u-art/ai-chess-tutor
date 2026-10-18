/** Conversational AI tutor: chat + live board + validated move chips. */
import { useEffect, useRef, useState } from 'react';
import type { TutorMessage } from '@chesstutor/shared';
import { api, ChessApiError } from '../api';
import { engine } from '../chess/engine';
import { ChessboardView } from '../components/Chessboard';
import { START_FEN, applyUci, uciParts, useChessGame } from '../chess/useChessGame';
import { Btn, Card, ErrorBox, Loading, SectionTitle } from '../components/ui';
import { Chess } from 'chess.js';

function uciToSan(fen: string, uci: string): string {
  try {
    const g = new Chess(fen);
    const { from, to, promotion } = uciParts(uci);
    return g.move({ from, to, promotion }).san;
  } catch {
    return uci;
  }
}

interface ChatEntry extends TutorMessage {
  moves?: string[];
  fenAtAsk?: string;
}

const HISTORY_LIMIT = 10;

export function Tutor() {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [engineNote, setEngineNote] = useState<string | null>(null);
  const game = useChessGame();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .diagnostics()
      .then((d) => setAiConfigured(d.aiConfigured))
      .catch(() => setAiConfigured(null));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const send = async (text: string, fenOverride?: string) => {
    const content = text.trim();
    if (!content || sending) return;
    setError(null);
    const fen = fenOverride ?? game.liveFen;
    const userMsg: ChatEntry = { role: 'user', content };
    const history: TutorMessage[] = [...messages, userMsg]
      .slice(-HISTORY_LIMIT)
      .map(({ role, content: c }) => ({ role, content: c }));
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setSending(true);

    // Attach a client-side engine read of the position when available.
    let engineRead: { bestUci: string; evalCp: number; depth: number } | null = null;
    try {
      await engine.init(6000);
      const a = await engine.analyze(fen, { depth: 12, timeMs: 700 });
      if (a) {
        engineRead = { bestUci: a.bestUci, evalCp: a.evalCp, depth: a.depth };
      } else {
        setEngineNote('Engine read unavailable for this position.');
      }
    } catch {
      setEngineNote('Engine read unavailable for this position.');
    }

    try {
      const res = await api.tutorChat({ messages: history, fen, engine: engineRead });
      setAiConfigured(res.aiConfigured);
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: res.reply, moves: res.validatedMoves, fenAtAsk: fen },
      ]);
    } catch (e) {
      setError(e instanceof ChessApiError ? e.message : 'The tutor did not respond.');
    } finally {
      setSending(false);
    }
  };

  const askAboutPosition = () => {
    send('What should I be thinking about in this position? What is the plan here?');
  };

  const playChip = (uci: string, fenAtAsk?: string) => {
    // Play the suggested move on the scratch board if it is legal there.
    const g = new Chess();
    try {
      g.load(fenAtAsk ?? game.liveFen);
    } catch {
      return;
    }
    if (applyUci(g, uci)) {
      game.loadFen(g.fen());
    }
  };

  return (
    <div className="p-4 pb-24 space-y-4">
      <SectionTitle>AI Tutor</SectionTitle>

      {aiConfigured === false && (
        <Card className="border-amber-900">
          <p className="text-sm text-amber-200">
            AI is not configured on the server. Set the AI provider credentials
            (see .env.example) to enable conversational coaching. The board,
            lessons and puzzles work without it.
          </p>
        </Card>
      )}

      <Card>
        <div className="flex justify-center mb-2">
          <ChessboardView
            id="tutor-board"
            fen={game.fen}
            orientation="white"
            onMove={(from, to, promotion) => game.move(from, to, promotion)}
          />
        </div>
        <div className="flex gap-1 justify-center">
          <Btn variant="subtle" onClick={game.undo}>Undo</Btn>
          <Btn variant="subtle" onClick={game.reset}>Reset</Btn>
          <Btn variant="subtle" onClick={askAboutPosition} disabled={sending}>
            Ask about this position
          </Btn>
        </div>
        <p className="text-[11px] text-slate-500 font-mono mt-2 break-all">{game.liveFen}</p>
        {engineNote && <p className="text-[11px] text-slate-500 mt-1">{engineNote}</p>}
      </Card>

      <div className="space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed ${
                m.role === 'user' ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 border border-slate-800 text-slate-200'
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.moves && m.moves.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {m.moves.map((uci) => (
                    <button
                      key={uci}
                      onClick={() => playChip(uci, m.fenAtAsk)}
                      className="min-h-[36px] px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-200 text-sm font-mono"
                    >
                      {uciToSan(m.fenAtAsk ?? START_FEN, uci)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && <Loading label="Tutor is thinking" />}
        <div ref={bottomRef} />
      </div>

      {error && <ErrorBox message={error} />}

      <div className="sticky bottom-20 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send(input);
          }}
          placeholder={aiConfigured === false ? 'AI not configured' : 'Ask about chess…'}
          disabled={aiConfigured === false || sending}
          className="flex-1 min-h-[48px] bg-slate-900 border border-slate-700 rounded-xl px-4 text-[15px] text-slate-100 placeholder:text-slate-500 disabled:opacity-50"
        />
        <Btn onClick={() => send(input)} disabled={aiConfigured === false || sending || !input.trim()}>
          Send
        </Btn>
      </div>
    </div>
  );
}

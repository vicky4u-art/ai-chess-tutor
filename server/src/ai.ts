/**
 * Server-side AI provider abstraction.
 * Keys stay on the server; the client only ever sees {aiConfigured}.
 *
 * Providers:
 * - openai:      POST $OPENAI_BASE/v1/chat/completions (default https://api.openai.com)
 * - anthropic:   POST https://api.anthropic.com/v1/messages
 * - compatible:  POST $AI_BASE_URL/chat/completions (OpenAI shape)
 */
export type AiProvider = 'openai' | 'anthropic' | 'compatible';

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  maxTokens: number;
}

export function loadAiConfig(): AiConfig | null {
  const provider = (process.env.AI_PROVIDER ?? '').toLowerCase() as AiProvider;
  const apiKey = process.env.AI_API_KEY ?? '';
  const model = process.env.AI_MODEL ?? '';
  if (!provider || !apiKey || !model) return null;
  if (!['openai', 'anthropic', 'compatible'].includes(provider)) {
    throw new Error(`Unknown AI_PROVIDER "${provider}" (expected openai|anthropic|compatible)`);
  }
  return {
    provider,
    apiKey,
    model,
    baseUrl: process.env.AI_BASE_URL || undefined,
    maxTokens: parseInt(process.env.AI_MAX_TOKENS ?? '600', 10),
  };
}

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export async function chatCompletion(cfg: AiConfig, system: string, messages: ChatMsg[]): Promise<string> {
  if (cfg.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: cfg.maxTokens,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await safeText(res)}`);
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    return (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
  }
  // openai + compatible share the OpenAI chat-completions shape
  const base = cfg.provider === 'openai' ? 'https://api.openai.com' : (cfg.baseUrl ?? '').replace(/\/$/, '');
  if (!base) throw new Error('AI_BASE_URL is required for AI_PROVIDER=compatible');
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: cfg.maxTokens,
      temperature: 0.4,
      messages: [{ role: 'system', content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
    }),
  });
  if (!res.ok) throw new Error(`AI API error ${res.status}: ${await safeText(res)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

/** System prompt for the Socratic chess tutor. */
export function tutorSystemPrompt(args: {
  fen: string;
  weakConcepts: string[];
  recentMistakes: string[];
  engine?: { bestUci: string; evalCp: number; depth: number } | null;
}): string {
  const lines = [
    'You are a patient, Socratic chess coach for an adult improver.',
    'Teach principles, not just moves. Ask questions before giving answers.',
    'When the student asks for a move, guide with questions first; give the move only if they are stuck.',
    'Adapt your depth: keep explanations concrete and jargon-light for beginners, precise for stronger players.',
    'When you mention a move, write it in coordinate (UCI) form like e2e4 as well as SAN.',
    'Never invent engine evaluations or variations — if you are unsure, say so.',
    `Current chess position (FEN): ${args.fen}. The active player is ${args.fen.split(' ')[1] === 'b' ? 'Black' : 'White'}.`,
    'All suggested moves must be legal from this specific FEN; use the verified engine read when available.',
  ];
  if (args.engine) {
    lines.push(
      `Verified engine read of the current position: best move ${args.engine.bestUci}, ` +
        `evaluation ${args.engine.evalCp} centipawns from the side-to-move's perspective at depth ${args.engine.depth}.`,
    );
  }
  if (args.weakConcepts.length) {
    lines.push(`The student's weakest areas right now: ${args.weakConcepts.join(', ')}. Weave in gentle reinforcement.`);
  }
  if (args.recentMistakes.length) {
    lines.push(`Recurring mistakes to watch for: ${args.recentMistakes.join('; ')}.`);
  }
  return lines.join('\n');
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '';
  }
}

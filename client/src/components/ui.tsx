/** Small shared UI primitives (dark-slate theme, large touch targets). */
import React from 'react';

export function Btn({
  children,
  onClick,
  variant = 'primary',
  disabled,
  className = '',
  type,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}) {
  const base =
    'min-h-[44px] px-4 py-2 rounded-xl font-medium text-[15px] transition-colors disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]';
  const styles: Record<string, string> = {
    primary: 'bg-amber-400 text-slate-950 hover:bg-amber-300',
    ghost: 'border border-slate-700 text-slate-200 hover:bg-slate-800',
    danger: 'border border-red-800 text-red-300 hover:bg-red-950',
    subtle: 'text-slate-300 hover:bg-slate-800',
  };
  return (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-4 ${className}`}>{children}</div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-slate-100 mb-2">{children}</h2>;
}

export function Bar({ value, className = '' }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={`h-2.5 rounded-full bg-slate-800 overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ConceptBar({
  name,
  value,
  uncertain,
}: {
  name: string;
  value: number;
  uncertain?: boolean;
}) {
  return (
    <div className="py-1.5">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm text-slate-200">
          {name}
          {uncertain && <span className="text-slate-500 text-xs ml-1">(uncertain)</span>}
        </span>
        <span className="text-sm text-slate-400 tabular-nums">{Math.round(value * 100)}%</span>
      </div>
      <Bar value={value} />
    </div>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return <div className="py-10 text-center text-slate-400">{label}…</div>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="border-red-900">
      <p className="text-red-300 text-sm mb-3">{message}</p>
      {onRetry && (
        <Btn variant="ghost" onClick={onRetry}>
          Retry
        </Btn>
      )}
    </Card>
  );
}

/**
 * Tiny markdown renderer (no new dependency): headings, bold, italic,
 * inline code, bullet/numbered lists, paragraphs. Anything else passes
 * through as plain text lines.
 */
export function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  let ordered: React.ReactNode[] = [];

  const inline = (s: string, key: string): React.ReactNode => {
    // `code` first, then **bold**, then *italic*.
    const parts = s.split(/(`[^`]+`)/g).map((chunk, i) => {
      if (chunk.startsWith('`') && chunk.endsWith('`') && chunk.length > 2) {
        return (
          <code key={`${key}-c${i}`} className="bg-slate-800 text-amber-200 px-1 rounded text-[13px]">
            {chunk.slice(1, -1)}
          </code>
        );
      }
      const b = chunk.split(/(\*\*[^*]+\*\*)/g).map((c2, j) => {
        if (c2.startsWith('**') && c2.endsWith('**') && c2.length > 4) {
          return <strong key={`${key}-b${i}-${j}`}>{c2.slice(2, -2)}</strong>;
        }
        const it = c2.split(/(\*[^*]+\*)/g).map((c3, k) =>
          c3.startsWith('*') && c3.endsWith('*') && c3.length > 2 ? (
            <em key={`${key}-i${i}-${j}-${k}`}>{c3.slice(1, -1)}</em>
          ) : (
            <React.Fragment key={`${key}-t${i}-${j}-${k}`}>{c3}</React.Fragment>
          ),
        );
        return <React.Fragment key={`${key}-f${i}-${j}`}>{it}</React.Fragment>;
      });
      return <React.Fragment key={`${key}-p${i}`}>{b}</React.Fragment>;
    });
    return <>{parts}</>;
  };

  const flushLists = (keyBase: string) => {
    if (list.length) {
      out.push(
        <ul key={`${keyBase}-ul`} className="list-disc pl-5 my-2 space-y-1 text-slate-300 text-[15px]">
          {list}
        </ul>,
      );
      list = [];
    }
    if (ordered.length) {
      out.push(
        <ol key={`${keyBase}-ol`} className="list-decimal pl-5 my-2 space-y-1 text-slate-300 text-[15px]">
          {ordered}
        </ol>,
      );
      ordered = [];
    }
  };

  lines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('### ')) {
      flushLists(`l${i}`);
      out.push(<h4 key={i} className="text-[15px] font-semibold text-slate-100 mt-3 mb-1">{inline(t.slice(4), `h${i}`)}</h4>);
    } else if (t.startsWith('## ')) {
      flushLists(`l${i}`);
      out.push(<h3 key={i} className="text-base font-semibold text-slate-100 mt-4 mb-1">{inline(t.slice(3), `h${i}`)}</h3>);
    } else if (t.startsWith('# ')) {
      flushLists(`l${i}`);
      out.push(<h2 key={i} className="text-lg font-semibold text-slate-100 mt-4 mb-1">{inline(t.slice(2), `h${i}`)}</h2>);
    } else if (/^[-*]\s+/.test(t)) {
      ordered = [];
      list.push(<li key={i}>{inline(t.replace(/^[-*]\s+/, ''), `li${i}`)}</li>);
    } else if (/^\d+\.\s+/.test(t)) {
      list = [];
      ordered.push(<li key={i}>{inline(t.replace(/^\d+\.\s+/, ''), `oli${i}`)}</li>);
    } else if (t === '') {
      flushLists(`l${i}`);
    } else {
      flushLists(`l${i}`);
      out.push(<p key={i} className="my-2 text-slate-300 text-[15px] leading-relaxed">{inline(t, `p${i}`)}</p>);
    }
  });
  flushLists('end');
  return <div>{out}</div>;
}

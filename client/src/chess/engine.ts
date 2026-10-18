/**
 * Stockfish WASM adapter (browser).
 *
 * stockfish.wasm@0.10.0 exports an asynchronous Stockfish() factory, not a
 * postMessage-ready Worker. Load it from /engine/stockfish.js and let the
 * official WASM runtime create its own engine threads.
 *
 * All callers share one engine, one UCI search at a time.
 */
export interface EngineAnalysis {
  bestUci: string;
  evalCp: number; // side-to-move perspective
  depth: number;
  mateIn?: number;
}
export interface AnalyzeOptions { depth?: number; timeMs?: number }

interface NativeEngine {
  addMessageListener(listener: (line: string) => void): void;
  postMessage(command: string): void;
  terminate?(): void;
}
type StockfishWindow = Window & { Stockfish?: () => Promise<NativeEngine> };
interface PendingAnalysis {
  resolve: (result: EngineAnalysis | null) => void;
  evalCp: number;
  depth: number;
  mateIn?: number;
  timer: ReturnType<typeof setTimeout>;
}
let scriptPromise: Promise<void> | null = null;

function threadsSupported(): boolean {
  try {
    return typeof SharedArrayBuffer === 'function'
      && new WebAssembly.Memory({ shared: true, initial: 8, maximum: 16 }).buffer instanceof SharedArrayBuffer;
  } catch { return false; }
}

/** Loads the vendor's documented global factory once, not in another Worker. */
function loadScript(): Promise<void> {
  if ((window as StockfishWindow).Stockfish) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/engine/stockfish.js';
    script.async = true;
    script.onload = () => {
      if ((window as StockfishWindow).Stockfish) resolve();
      else reject(new Error('Stockfish() was not defined after loading its script.'));
    };
    script.onerror = () => reject(new Error('Could not load /engine/stockfish.js.'));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}

export class StockfishEngine {
  private native: NativeEngine | null = null;
  private ready = false;
  private initPromise: Promise<void> | null = null;
  private pending: PendingAnalysis | null = null;

  get available(): boolean { return this.ready && this.native !== null; }

  init(timeoutMs = 10000): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.initPromise) return this.initPromise;
    this.initPromise = new Promise<void>((resolve, reject) => {
      if (!threadsSupported()) {
        reject(new Error('Engine unavailable: shared WebAssembly memory requires cross-origin isolation.'));
        return;
      }
      let expired = false;
      const timeout = setTimeout(() => {
        expired = true;
        this.fail(new Error('Engine unavailable: timed out waiting for Stockfish.'));
        reject(new Error('Engine unavailable: timed out waiting for Stockfish.'));
      }, timeoutMs);
      const start = async () => {
        await loadScript();
        const factory = (window as StockfishWindow).Stockfish;
        if (!factory) throw new Error('Stockfish factory not available.');
        const sf = await factory();
        if (expired) {
          sf.terminate?.();
          return;
        }
        this.native = sf;
        let sawUciOk = false;
        sf.addMessageListener((raw) => {
          const line = String(raw).trim();
          if (this.ready) { this.handleLine(line); return; }
          if (line === 'uciok') {
            sawUciOk = true;
            sf.postMessage('isready');
          } else if (sawUciOk && line === 'readyok') {
            clearTimeout(timeout);
            this.ready = true;
            resolve();
          }
        });
        sf.postMessage('uci');
      };
      start().catch((error: unknown) => {
        clearTimeout(timeout);
        if (expired) return;
        const err = error instanceof Error ? error : new Error(String(error));
        this.fail(err);
        reject(err);
      });
    }).catch((error: unknown) => {
      this.initPromise = null; // allow a fresh attempt after transient failures
      throw error;
    });
    return this.initPromise;
  }

  async analyze(fen: string, options: AnalyzeOptions = {}): Promise<EngineAnalysis | null> {
    if (!this.available || !this.native) return null;
    const depth = options.depth ?? 12;
    const timeMs = options.timeMs ?? 800;
    if (this.pending) {
      // Do not overlap commands: a stopped search must finish before a new one.
      this.native.postMessage('stop');
      const prior = this.pending;
      await new Promise<void>((resolve) => {
        const started = Date.now();
        const poll = () => {
          if (!this.pending || this.pending !== prior || Date.now() - started > 1500) resolve();
          else setTimeout(poll, 30);
        };
        poll();
      });
      if (this.pending) return null;
    }
    return new Promise<EngineAnalysis | null>((resolve) => {
      const timer = setTimeout(() => {
        const prior = this.pending;
        this.pending = null;
        this.native?.postMessage('stop');
        prior?.resolve(null);
      }, timeMs + 5000);
      this.pending = { resolve, evalCp: 0, depth: 0, timer };
      this.native!.postMessage('position fen ' + fen);
      this.native!.postMessage('go depth ' + depth + ' movetime ' + timeMs);
    });
  }

  stop(): void {
    if (!this.pending) return;
    this.native?.postMessage('stop');
  }

  terminate(): void {
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.resolve(null);
      this.pending = null;
    }
    this.native?.terminate?.();
    this.native = null;
    this.ready = false;
    this.initPromise = null;
  }

  private fail(error: Error): void {
    console.warn('[engine]', error.message);
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.resolve(null);
      this.pending = null;
    }
    this.native?.terminate?.();
    this.native = null;
    this.ready = false;
  }

  private handleLine(line: string): void {
    const p = this.pending;
    if (!p) return;
    if (line.startsWith('bestmove')) {
      const best = line.match(/^bestmove\s+(\S+)/)?.[1];
      clearTimeout(p.timer);
      this.pending = null;
      p.resolve(best && best !== '(none)'
        ? { bestUci: best, evalCp: p.evalCp, depth: p.depth, mateIn: p.mateIn }
        : null);
      return;
    }
    const info = line.match(/^info\s+depth\s+(\d+).*?\bscore\s+(cp|mate)\s+(-?\d+)/);
    if (!info) return;
    const depth = Number(info[1]);
    if (depth < p.depth) return;
    p.depth = depth;
    if (info[2] === 'mate') {
      const mate = Number(info[3]);
      p.mateIn = mate;
      p.evalCp = mate > 0 ? 100000 - mate : -100000 - mate;
    } else {
      p.evalCp = Number(info[3]);
      p.mateIn = undefined;
    }
  }
}
export const engine = new StockfishEngine();

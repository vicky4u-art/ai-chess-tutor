/**
 * Stockfish Web Worker client.
 *
 * Loads the engine files copied to /engine/ at build time (stockfish.js +
 * stockfish.wasm). The stockfish.wasm 0.10.0 build is threaded and needs
 * SharedArrayBuffer (COOP/COEP headers on the host); when the environment
 * cannot provide that, init() fails gracefully and the app runs without
 * engine analysis.
 *
 * All methods are safe to call when the engine is unavailable: analyze()
 * returns null and init() rejects with a plain Error instead of hanging.
 */

export interface EngineAnalysis {
  /** Best move in UCI notation, e.g. "e2e4" or "e7e8q". */
  bestUci: string;
  /** Centipawn evaluation from the side-to-move's perspective. */
  evalCp: number;
  depth: number;
  /** Mate distance from the side-to-move's perspective (positive = mates). */
  mateIn?: number;
}

export interface AnalyzeOptions {
  depth?: number;
  /** Soft time cap in ms; combined with depth (engine stops at first limit). */
  timeMs?: number;
}

interface PendingAnalysis {
  resolve: (a: EngineAnalysis | null) => void;
  bestUci: string | null;
  evalCp: number;
  depth: number;
  mateIn?: number;
  timer: ReturnType<typeof setTimeout>;
}

function threadsSupported(): boolean {
  try {
    if (typeof SharedArrayBuffer !== 'function') return false;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _mem = new WebAssembly.Memory({ shared: true, initial: 8, maximum: 16 });
    return true;
  } catch {
    return false;
  }
}

export class StockfishEngine {
  private worker: Worker | null = null;
  private ready = false;
  private initPromise: Promise<void> | null = null;
  private pending: PendingAnalysis | null = null;
  private stopping = false;

  get available(): boolean {
    return this.ready && this.worker !== null;
  }

  /**
   * Load the engine and complete the UCI handshake. Resolves when the
   * engine answers `readyok`; rejects (after `timeoutMs`) when the engine
   * cannot start in this environment.
   */
  init(timeoutMs = 10000): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = new Promise<void>((resolve, reject) => {
      if (!threadsSupported()) {
        reject(new Error('Engine unavailable: this browser/page does not provide SharedArrayBuffer (needs COOP/COEP headers).'));
        return;
      }
      let worker: Worker;
      try {
        // stockfish.wasm exposes Stockfish() factory, NOT a UCI command worker.
        // A bridge script loads the factory and forwards UCI commands/events.
        worker = new Worker('/engine/stockfish-bridge.js');
      } catch (e) {
        reject(new Error(`Engine unavailable: could not start worker (${(e as Error).message}).`));
        return;
      }
      this.worker = worker;

      const timer = setTimeout(() => {
        this.fail(new Error('Engine unavailable: timed out waiting for the engine to start.'));
        reject(new Error('Engine unavailable: timed out waiting for the engine to start.'));
      }, timeoutMs);

      let sawUciOk = false;
      worker.onmessage = (ev: MessageEvent) => {
        const line = String(ev.data);
        if (line.startsWith('engine-error:')) {
          clearTimeout(timer);
          const err = new Error('Engine unavailable: ' + line.slice('engine-error:'.length));
          this.fail(err);
          reject(err);
          return;
        }
        if (!sawUciOk && line === 'uciok') {
          sawUciOk = true;
          worker.postMessage('isready');
          return;
        }
        if (sawUciOk && line === 'readyok') {
          clearTimeout(timer);
          this.ready = true;
          // Keep a permanent dispatcher for analysis lines.
          worker.onmessage = (e: MessageEvent) => this.handleLine(String(e.data));
          resolve();
        }
      };
      worker.onerror = (ev) => {
        clearTimeout(timer);
        const msg = ev.message || 'worker error';
        this.fail(new Error(`Engine unavailable: ${msg}`));
        reject(new Error(`Engine unavailable: ${msg}`));
      };
      worker.postMessage('uci');
    });
    return this.initPromise;
  }

  /**
   * Analyze a position. Returns null when the engine is unavailable.
   * Never hangs: a hard timeout guards the search.
   */
  async analyze(fen: string, opts: AnalyzeOptions = {}): Promise<EngineAnalysis | null> {
    if (!this.available || !this.worker) return null;
    const depth = opts.depth ?? 12;
    const timeMs = opts.timeMs ?? 800;

    // One analysis at a time: stop any in-flight search first.
    if (this.pending) {
      this.stop();
      await new Promise((r) => setTimeout(r, 60));
      if (this.pending) {
        // Still busy after asking it to stop — bail out rather than hang.
        return null;
      }
    }

    return new Promise<EngineAnalysis | null>((resolve) => {
      const timer = setTimeout(() => {
        this.pending = null;
        this.worker?.postMessage('stop');
        resolve(null);
      }, timeMs + 5000);

      this.pending = { resolve, bestUci: null, evalCp: 0, depth: 0, timer };
      this.worker!.postMessage(`position fen ${fen}`);
      this.worker!.postMessage(`go depth ${depth} movetime ${timeMs}`);
    });
  }

  /** Ask the engine to stop the current search. */
  stop(): void {
    if (!this.worker || !this.pending) return;
    this.stopping = true;
    this.worker.postMessage('stop');
    // If no bestmove arrives, release the pending analysis shortly.
    setTimeout(() => {
      if (this.pending && this.stopping) {
        clearTimeout(this.pending.timer);
        const p = this.pending;
        this.pending = null;
        this.stopping = false;
        p.resolve(null);
      }
    }, 1500);
  }

  terminate(): void {
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.resolve(null);
      this.pending = null;
    }
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.initPromise = null;
  }

  private fail(err: Error): void {
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.resolve(null);
      this.pending = null;
    }
    this.ready = false;
    try {
      this.worker?.terminate();
    } catch {
      /* ignore */
    }
    this.worker = null;
    // Surface the reason via console for diagnostics; callers get rejections/nulls.
    console.warn('[engine]', err.message);
  }

  private handleLine(line: string): void {
    const p = this.pending;
    if (!p) return;
    if (line.startsWith('bestmove')) {
      const m = line.match(/^bestmove\s+(\S+)/);
      const best = m ? m[1] : null;
      clearTimeout(p.timer);
      this.pending = null;
      this.stopping = false;
      if (!best || best === '(none)') {
        p.resolve(null);
      } else {
        p.resolve({ bestUci: best, evalCp: p.evalCp, depth: p.depth, mateIn: p.mateIn });
      }
      return;
    }
    // Parse: info depth 12 ... score cp 35 ...  (or score mate 3)
    const info = line.match(/^info\s+depth\s+(\d+).*?\bscore\s+(cp|mate)\s+(-?\d+)/);
    if (info) {
      const d = parseInt(info[1], 10);
      // Keep the deepest read seen so far.
      if (d >= p.depth) {
        p.depth = d;
        if (info[2] === 'mate') {
          const mateIn = parseInt(info[3], 10);
          p.mateIn = mateIn;
          // Mate scores dominate: represent as a large cp value.
          p.evalCp = mateIn > 0 ? 100000 - mateIn : -100000 - mateIn;
        } else {
          p.evalCp = parseInt(info[3], 10);
          p.mateIn = undefined;
        }
      }
    }
  }
}

/** Shared singleton: pages probe it in Diagnostics and reuse it in Analyze/Tutor. */
export const engine = new StockfishEngine();

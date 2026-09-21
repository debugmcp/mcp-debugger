/**
 * Everything the shim remembers about one debug session, and the generation
 * discipline that keeps it honest.
 *
 * A "generation" is one stop of the debuggee. Frame ids, the shim's variables
 * references, decoded memory: all of it describes the program at one stop and
 * becomes fiction the moment it resumes. So every `stopped`/`continued` bumps
 * the generation and drops those caches wholesale; a reference from an older
 * generation is answered with an error instead of stale bytes.
 *
 * Variables references the shim hands out live in the band `[2^30, 2^31)`: the
 * engine's handles are small sequential integers (a few thousand at most), so
 * the two namespaces cannot meet. A forwarded engine reference that does land
 * in the band is logged as `REF_BAND_COLLISION` (fatal under `--ref-check
 * strict`, the tests' setting) because it would be misrouted silently.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { CobolSection } from '../manifest/schema.js';
import type { CobolShimSessionOptions } from '../shim-protocol.js';
import { BreakpointTable } from './breakpoint-table.js';
import type { ShimLogger } from './logger.js';
import { ManifestRegistry, type ProgramEntry } from './manifest-registry.js';

export const SHIM_REF_BASE = 1 << 30;
export const SHIM_REF_LIMIT = 2 ** 31;

export interface ShimOptions {
  manifestDirs: string[];
  engineScopes: boolean;
  refCheck: 'strict' | 'warn';
}

/** One frame of the last `stackTrace` of this generation, as the shim presented it. */
export interface CachedFrame {
  id: number;
  /** Position in the stack (0 = innermost) — what "walk up to the nearest COBOL frame" walks. */
  index: number;
  threadId: number;
  program?: ProgramEntry;
  /** True for a body-function frame with a COBOL location: the frames that get COBOL scopes. */
  isCobol: boolean;
  /** `HELLO: 0000-MAIN` — the name the client saw. */
  label: string;
  paragraph?: string;
  section?: string;
  sourcePath?: string;
  line?: number;
  /** Set when the engine reported a generated-C location that the line map translated. */
  remappedFromC?: { path: string; line: number };
  /**
   * A synthesised PERFORM frame (see perform-stack.ts): the engine frame its storage,
   * scopes and expressions are read in. Unset on real frames.
   */
  evalFrameId?: number;
}

/** The engine frame a cached frame's storage is read in: itself, or the real frame behind a synthesised one. */
export function engineFrameId(frame: CachedFrame): number {
  return frame.evalFrameId ?? frame.id;
}

/** Synthesised frame ids live above CodeLLDB's (thread-indexed thousands) and below the variables band. */
export const SHIM_FRAME_ID_BASE = 1 << 28;

export type ShimRef =
  | { gen: number; kind: 'section'; frameId: number; program: ProgramEntry; section: CobolSection }
  | {
      gen: number;
      /** `item`: a group or a whole table; `element`: one element of a table (all subscripts fixed). */
      kind: 'item' | 'element';
      frameId: number;
      program: ProgramEntry;
      itemId: number;
      /** Zero-based subscript per OCCURS dimension, outermost first. */
      indices: number[];
    };

/** `Omit` over a union keeps only the shared keys; distribute it so each variant keeps its own. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type ShimRefInput = DistributiveOmit<ShimRef, 'gen'>;

export type RefLookup = { ok: true; ref: ShimRef } | { ok: false; stale: boolean };

export interface RuntimeErrorStop {
  gen: number;
  threadId?: number;
  /** Formatted libcob message, or an explicitly labelled unformatted fallback. */
  text?: string;
}

export class SessionState {
  readonly options: ShimOptions;
  readonly registry: ManifestRegistry;
  generation = 0;
  /** `launch` or `attach`, from the request that started the session (unset until one arrives). */
  mode?: 'launch' | 'attach';
  /** Stops seen so far; the first one after an attach is the attach handshake's. */
  stopsSeen = 0;
  /** A client `pause` was forwarded, not refused, and no stop has arrived since. */
  pausePending = false;
  /** The attach asked for a stop on entry, so its first stop is the handshake's (CodeLLDB resumes otherwise). */
  attachStopExpected = false;
  /** Threads whose full stack (WALK_UP_STACK_LEVELS deep) is cached this generation. */
  readonly deepFetched = new Set<number>();
  lastThreadId?: number;
  engineCapabilities?: DebugProtocol.Capabilities;
  /** The client's engine-bound (C symbol) function breakpoints, replayed in every union with the runtime-error hook. */
  userFunctionBps: DebugProtocol.FunctionBreakpoint[] = [];
  /** Every source breakpoint the engine holds, per file: the client's lines plus the shim's own. */
  readonly breakpoints = new BreakpointTable();
  runtimeErrorArmed = false;
  runtimeErrorBpId?: number;
  lastRuntimeError?: RuntimeErrorStop;

  private readonly frames = new Map<number, CachedFrame>();
  private readonly refs = new Map<number, ShimRef>();
  private nextRef = SHIM_REF_BASE;
  private nextFrameId = SHIM_FRAME_ID_BASE;
  /** Per-generation memoisation of address evaluations and record reads (values are promises: concurrent readers share one engine round trip). */
  private readonly memo = new Map<string, Promise<unknown>>();
  /** Successful static addresses survive stops, but never a process/module change. */
  private readonly processMemo = new Map<string, Promise<unknown>>();

  constructor(options: ShimOptions, private readonly logger: ShimLogger, registry?: ManifestRegistry) {
    this.options = options;
    this.registry = registry ?? new ManifestRegistry(logger);
  }

  /** Merge the private block of a launch/attach request into the session options. */
  applySessionOptions(block: Partial<CobolShimSessionOptions> | undefined): void {
    if (!block) {
      return;
    }
    for (const dir of block.manifestDirs ?? []) {
      if (!this.options.manifestDirs.includes(dir)) {
        this.options.manifestDirs.push(dir);
      }
    }
    if (block.engineScopes !== undefined) {
      this.options.engineScopes = block.engineScopes;
    }
    if (block.refCheck !== undefined) {
      this.options.refCheck = block.refCheck;
    }
  }

  /** Load the configured manifest dirs; lazily, so a lookup before launch still sees them. */
  ensureManifests(): void {
    this.registry.loadDirs(this.options.manifestDirs);
  }

  bumpGeneration(reason: string): void {
    this.generation += 1;
    this.frames.clear();
    this.refs.clear();
    this.memo.clear();
    this.deepFetched.clear();
    this.nextRef = SHIM_REF_BASE;
    this.nextFrameId = SHIM_FRAME_ID_BASE;
    this.logger.debug(`generation ${this.generation} (${reason})`);
  }

  invalidateProcess(reason: string): void {
    this.processMemo.clear();
    this.bumpGeneration(reason);
  }

  memoiseProcess<T>(key: string, compute: () => Promise<T>, cacheable: (value: T) => boolean): Promise<T> {
    const existing = this.processMemo.get(key);
    if (existing) return existing as Promise<T>;
    const forget = (): void => {
      // A pending read from an old process must not evict a replacement's address.
      if (this.processMemo.get(key) === created) this.processMemo.delete(key);
    };
    const created = compute().then(value => {
      if (!cacheable(value)) forget();
      return value;
    }, error => {
      forget();
      throw error;
    });
    this.processMemo.set(key, created);
    return created;
  }

  /** A frame id for a synthesised frame of this generation. */
  allocFrameId(): number {
    return this.nextFrameId++;
  }

  cacheFrame(frame: CachedFrame): void {
    this.frames.set(frame.id, frame);
  }

  frame(frameId: number): CachedFrame | undefined {
    return this.frames.get(frameId);
  }

  /** Frames of one thread, innermost first — only what the last `stackTrace` fetched. */
  framesOfThread(threadId: number): CachedFrame[] {
    return [...this.frames.values()].filter((f) => f.threadId === threadId).sort((a, b) => a.index - b.index);
  }

  allocRef(ref: ShimRefInput): number {
    if (this.nextRef >= SHIM_REF_LIMIT) {
      throw new Error('shim variables reference band exhausted');
    }
    const id = this.nextRef++;
    this.refs.set(id, { ...ref, gen: this.generation } as ShimRef);
    return id;
  }

  isShimRef(id: number): boolean {
    return id >= SHIM_REF_BASE && id < SHIM_REF_LIMIT;
  }

  lookupRef(id: number): RefLookup {
    const ref = this.refs.get(id);
    if (ref && ref.gen === this.generation) {
      return { ok: true, ref };
    }
    // Refs are cleared on every bump, so an in-band id that is not present now
    // was necessarily handed out in an earlier generation.
    return { ok: false, stale: this.isShimRef(id) };
  }

  /** Memoise one engine-backed computation for the current generation. */
  memoise<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const scoped = `${this.generation}:${key}`;
    const existing = this.memo.get(scoped);
    if (existing) {
      return existing as Promise<T>;
    }
    const created = compute();
    this.memo.set(scoped, created);
    return created;
  }
}

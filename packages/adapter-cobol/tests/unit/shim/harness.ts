/**
 * Runs `createCobolShim` end to end without CodeLLDB: the injected `spawnFn`
 * returns a fake child whose "engine" is a FakeEngine listening on the port the
 * shim passed in `--port`; `exit` is recorded instead of killing the worker.
 */
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { CobolManifest } from '../../../src/manifest/schema.js';
import type { CobolShimArgv } from '../../../src/shim-protocol.js';
import type { ShimLogger } from '../../../src/shim/logger.js';
import { createCobolShim, type CobolShimHandle, type ShimDeps, type ShimTiming } from '../../../src/shim/shim-core.js';
import { FakeEngine } from './fake-engine.js';
import { TestClient } from './test-client.js';

export class FakeChild extends EventEmitter {
  pid = 4242;
  killed = false;
  killCalls = 0;
  exited = false;

  constructor(private readonly engine: FakeEngine) {
    super();
  }

  /** What the shim calls; the fake dies asynchronously like a real child would. */
  kill(): boolean {
    this.killCalls += 1;
    this.killed = true;
    setImmediate(() => this.exitWith(null, 'SIGTERM'));
    return true;
  }

  exitWith(code: number | null, signal: NodeJS.Signals | null = null): void {
    if (this.exited) {
      return;
    }
    this.exited = true;
    this.engine.close();
    this.emit('exit', code, signal);
  }
}

export interface SpawnCall {
  command: string;
  args: string[];
  options: SpawnOptions;
}

export interface HarnessOptions {
  manifests?: CobolManifest[];
  argv?: Partial<CobolShimArgv>;
  timing?: Partial<ShimTiming>;
  platform?: NodeJS.Platform;
  arch?: string;
  /** Configure the fake engine before the shim connects to it. */
  engineSetup?: (engine: FakeEngine) => void;
  /** Skip connecting a client (lifecycle tests drive that themselves). */
  noClient?: boolean;
  /** Let the fake engine come up late (or never, for the connect-timeout path). */
  delayEngineListenMs?: number;
  /** Called instead of `fs.openSync` for `--stdin-file`. */
  openStdinFile?: (file: string) => number;
  closeFd?: (fd: number) => void;
}

export interface Harness {
  engine: FakeEngine;
  client: TestClient;
  child: FakeChild;
  handle: CobolShimHandle;
  spawnCalls: SpawnCall[];
  exitCodes: number[];
  logs: string[];
  manifestDir: string;
  connectClient(): Promise<TestClient>;
  cleanup(): Promise<void>;
}

export function recordingLogger(lines: string[]): ShimLogger {
  const push = (level: string) => (message: string, data?: unknown) => {
    lines.push(`[${level}] ${message}${data === undefined ? '' : ` ${data instanceof Error ? data.message : JSON.stringify(data)}`}`);
  };
  return { debug: push('debug'), info: push('info'), warn: push('warn'), error: push('error') };
}

export async function startShim(options: HarnessOptions = {}): Promise<Harness> {
  const manifestDir = mkdtempSync(path.join(os.tmpdir(), 'cobol-shim-test-'));
  (options.manifests ?? []).forEach((manifest, i) => {
    writeFileSync(path.join(manifestDir, `unit${i}.cobol-symbols.json`), JSON.stringify(manifest));
  });
  const engine = new FakeEngine();
  options.engineSetup?.(engine);
  const child = new FakeChild(engine);
  const spawnCalls: SpawnCall[] = [];
  const exitCodes: number[] = [];
  const logs: string[] = [];
  const pendingTimers: NodeJS.Timeout[] = [];

  const deps: ShimDeps = {
    logger: recordingLogger(logs),
    exit: (code) => {
      exitCodes.push(code);
    },
    spawnFn: (command, args, spawnOptions) => {
      spawnCalls.push({ command, args, options: spawnOptions });
      const port = Number(args[args.indexOf('--port') + 1]);
      const listenTimer = setTimeout(() => void engine.listen(port), options.delayEngineListenMs ?? 0);
      pendingTimers.push(listenTimer);
      return child as unknown as ChildProcess;
    },
    timing: { connectRetryMs: 20, connectTimeoutMs: 5000, disconnectGraceMs: 200, ...options.timing },
    platform: options.platform,
    arch: options.arch,
    openStdinFile: options.openStdinFile,
    closeFd: options.closeFd
  };
  const config: CobolShimArgv = {
    listenPort: 0,
    manifestDirs: [manifestDir],
    engineCommand: ['fake-codelldb', '--liblldb', 'liblldb.so'],
    refCheck: 'strict',
    ...options.argv
  };
  const handle = createCobolShim(config, deps);
  await handle.ready;

  let client: TestClient | undefined;
  const connectClient = async (): Promise<TestClient> => {
    client = await TestClient.connect(handle.port());
    await engine.waitForConnection();
    return client;
  };
  if (!options.noClient && !options.delayEngineListenMs) {
    await connectClient();
  } else if (!options.noClient) {
    client = await TestClient.connect(handle.port());
  }

  const harness: Harness = {
    engine,
    get client() {
      if (!client) {
        throw new Error('no client connected');
      }
      return client;
    },
    child,
    handle,
    spawnCalls,
    exitCodes,
    logs,
    manifestDir,
    connectClient,
    cleanup: async () => {
      pendingTimers.forEach((timer) => clearTimeout(timer));
      await client?.close();
      engine.close();
      handle.cleanup();
      await new Promise<void>((resolve) => handle.server.close(() => resolve()));
      rmSync(manifestDir, { recursive: true, force: true });
    }
  };
  return harness;
}

/** `initialize` + `launch` through the shim with the private block pointing at the harness manifests. */
export async function bringUp(h: Harness, launchExtras: Record<string, unknown> = {}): Promise<{
  initialize: DebugProtocol.Response;
  launch: DebugProtocol.Response;
}> {
  const initialize = await h.client.request('initialize', { clientID: 'test', adapterID: 'lldb' });
  const launch = await h.client.request('launch', {
    program: '/work/hello',
    __cobol: { manifestDirs: [h.manifestDir] },
    ...launchExtras
  });
  return { initialize, launch };
}

/** Make the engine report `frames` for `stackTrace`, emit a `stopped`, and fetch the client's view. */
export async function stopWithFrames(
  h: Harness,
  frames: DebugProtocol.StackFrame[],
  stopped: Partial<DebugProtocol.StoppedEvent['body']> = {}
): Promise<DebugProtocol.StackFrame[]> {
  h.engine.on('stackTrace', (args: DebugProtocol.StackTraceArguments) => {
    const start = args.startFrame ?? 0;
    const levels = args.levels && args.levels > 0 ? args.levels : frames.length;
    return { stackFrames: frames.slice(start, start + levels).map((f) => ({ ...f, source: f.source ? { ...f.source } : undefined })), totalFrames: frames.length };
  });
  h.engine.emit('stopped', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true, ...stopped });
  await h.client.nextEvent('stopped');
  const response = await h.client.request('stackTrace', { threadId: 1, startFrame: 0, levels: 20 });
  return (response.body as DebugProtocol.StackTraceResponse['body']).stackFrames;
}

export function frame(id: number, name: string, sourcePath: string | undefined, line: number): DebugProtocol.StackFrame {
  return {
    id,
    name,
    line,
    column: 1,
    source: sourcePath ? { name: path.basename(sourcePath), path: sourcePath } : undefined
  };
}

export const tick = (ms = 30): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitFor(predicate: () => boolean, timeoutMs = 3000, what = 'condition'): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for ${what}`);
    }
    await tick(10);
  }
}

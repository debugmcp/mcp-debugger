/**
 * Lifecycle of the COBOL DAP shim process: one TCP listener for mcp-debugger's
 * proxy, one CodeLLDB child spawned on the first connection, one socket to it,
 * and a teardown that leaves neither behind.
 *
 * CodeLLDB is spawned with the shim's stdio inherited on purpose: on Windows
 * the debuggee's DISPLAY output arrives on the adapter process's stdout and
 * mcp-debugger forwards that as program output, so the shim must not sit in
 * the way (and must never write there itself — see logger.ts). `--stdin-file`
 * is opened here and handed down as the child's stdin so `ACCEPT FROM SYSIN`
 * reads it; on POSIX the adapter also sets `target.input-path`, so the fd is
 * a no-op there.
 *
 * Every process-level effect (spawn, connect, exit, file open) is injectable
 * so the whole lifecycle runs under a fake engine in unit tests.
 */
import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import net from 'node:net';
import type { CobolShimArgv } from '../shim-protocol.js';
import { ClientConnection, type ClientInbound } from './client-connection.js';
import { EngineClient } from './engine-client.js';
import { createFileLogger, type ShimLogger } from './logger.js';
import { Router, type ForwardMeta } from './router.js';
import { SessionState } from './session-state.js';

export interface ShimTiming {
  /** Backoff between connection attempts to the freshly spawned engine. */
  connectRetryMs: number;
  /** Give up connecting after this long (the engine failed to start). */
  connectTimeoutMs: number;
  /** After the client's disconnect/terminate, or after the client goes away: wait this long for the engine to exit, then kill it. */
  disconnectGraceMs: number;
  /** How long a shim-originated engine request (address, memory, internal stack) may take before it degrades. */
  engineRequestTimeoutMs: number;
  /** On exit, how long to wait for the client socket to drain its last frames before leaving anyway. */
  clientFlushMs: number;
}

export const DEFAULT_TIMING: ShimTiming = {
  connectRetryMs: 100,
  connectTimeoutMs: 15_000,
  disconnectGraceMs: 2_000,
  engineRequestTimeoutMs: 5_000,
  clientFlushMs: 500
};

export interface ShimDeps {
  createServer?: (listener: (socket: net.Socket) => void) => net.Server;
  connect?: (port: number, host: string) => net.Socket;
  spawnFn?: (command: string, args: string[], options: SpawnOptions) => ChildProcess;
  logger?: ShimLogger;
  now?: () => number;
  exit?: (code: number) => void;
  /** `fs.openSync(file, 'r')` — the debuggee's stdin. */
  openStdinFile?: (file: string) => number;
  closeFd?: (fd: number) => void;
  timing?: Partial<ShimTiming>;
  platform?: NodeJS.Platform;
  arch?: string;
}

export interface CobolShimHandle {
  server: net.Server;
  /** Resolves once the listener is bound; rejects when the port cannot be taken. */
  ready: Promise<void>;
  /** The bound port (meaningful after `ready`; `listenPort: 0` picks one). */
  port(): number;
  cleanup(): void;
}

function pickEphemeralPort(createServer: NonNullable<ShimDeps['createServer']>): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer(() => undefined);
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => (port > 0 ? resolve(port) : reject(new Error('could not pick an engine port'))));
    });
  });
}

export function createCobolShim(config: CobolShimArgv, deps: ShimDeps = {}): CobolShimHandle {
  const logger = deps.logger ?? createFileLogger(config.logFile);
  const createServer = deps.createServer ?? ((listener) => net.createServer(listener));
  const connect = deps.connect ?? ((port, host) => net.connect({ port, host }));
  const spawnFn = deps.spawnFn ?? spawn;
  const now = deps.now ?? Date.now;
  const exit = deps.exit ?? ((code: number) => process.exit(code));
  const openStdinFile = deps.openStdinFile ?? ((file: string) => openSync(file, 'r'));
  const closeFd = deps.closeFd ?? closeSync;
  const timing: ShimTiming = { ...DEFAULT_TIMING, ...deps.timing };
  const platform = deps.platform ?? process.platform;
  const arch = deps.arch ?? process.arch;

  const state = new SessionState(
    { manifestDirs: [...config.manifestDirs], engineScopes: config.engineScopes === true, refCheck: config.refCheck ?? 'warn' },
    logger
  );

  let client: ClientConnection | undefined;
  let engine: EngineClient<ForwardMeta> | undefined;
  let router: Router | undefined;
  let child: ChildProcess | undefined;
  let childExit: { code: number | null; signal: NodeJS.Signals | null } | undefined;
  let shuttingDown = false;
  let graceTimer: NodeJS.Timeout | undefined;
  const pendingClientMessages: ClientInbound[] = [];

  const killEngine = (): void => {
    if (child && !childExit) {
      logger.info(`killing engine pid ${child.pid ?? '?'}`);
      try {
        child.kill();
      } catch (error) {
        logger.warn('engine kill failed', error);
      }
    }
  };

  let exited = false;
  /** Set by `finish` while it waits for the client socket to drain; the client's close handler fires it. */
  let onClientDrained: (() => void) | undefined;

  const exitNow = (code: number): void => {
    if (exited) {
      return;
    }
    exited = true;
    engine?.close();
    client?.destroy();
    server.close();
    logger.info(`shim exit ${code}`);
    exit(code);
  };

  /**
   * Leave, but only after the client has the last frames. The `disconnect` response and a
   * `terminated`/`exited` event are written microseconds before the engine goes away;
   * `socket.destroy()` would drop them from the write buffer and `process.exit` skips the
   * event loop, so the socket is ended and the exit waits for its close (capped).
   */
  const finish = (code: number): void => {
    if (graceTimer) {
      clearTimeout(graceTimer);
      graceTimer = undefined;
    }
    if (exited) {
      return;
    }
    if (!client || client.isClosed) {
      exitNow(code);
      return;
    }
    const cap = setTimeout(() => exitNow(code), timing.clientFlushMs);
    onClientDrained = () => {
      clearTimeout(cap);
      exitNow(code);
    };
    client.end();
  };

  /** Set while an exit waits for the engine socket to drain; the engine client's close handler fires it. */
  let onEngineDrained: (() => void) | undefined;

  /**
   * The child's `exit` and its socket's last `data` are independent events: the engine
   * answers `disconnect` and quits, and Node may report the exit before the response has
   * been read. The socket's `close` follows the last byte, so wait for it (capped) before
   * the client is ended — otherwise the reply the engine did send would be lost here.
   */
  const finishAfterEngineDrained = (code: number): void => {
    if (!engine || engine.isClosed) {
      finish(code);
      return;
    }
    const cap = setTimeout(() => finish(code), timing.clientFlushMs);
    onEngineDrained = () => {
      clearTimeout(cap);
      finish(code);
    };
  };

  /** Wait for the engine to exit on its own for `disconnectGraceMs`, then kill it; finish either way. */
  const waitForEngineThenFinish = (code: () => number): void => {
    if (!child || childExit) {
      finishAfterEngineDrained(code());
      return;
    }
    graceTimer = setTimeout(() => {
      graceTimer = undefined;
      killEngine();
      finishAfterEngineDrained(code());
    }, timing.disconnectGraceMs);
    child.once('exit', () => {
      if (graceTimer) {
        clearTimeout(graceTimer);
        graceTimer = undefined;
        finishAfterEngineDrained(code());
      }
    });
  };

  const onClientClosed = (): void => {
    logger.info('client disconnected');
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    // The client is gone: give the engine the grace it needs to take the debuggee down, then leave.
    waitForEngineThenFinish(() => 0);
  };

  /** The engine process exited or its socket closed: leave with its code once everything it sent is delivered. */
  const onEngineGone = (): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    waitForEngineThenFinish(() => (childExit ? (childExit.code ?? 1) : 1));
  };

  const fatal = (message: string): void => {
    logger.error(`fatal: ${message}`);
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    killEngine();
    finish(2);
  };

  const connectWithRetry = (port: number): Promise<net.Socket> =>
    new Promise((resolve, reject) => {
      const deadline = now() + timing.connectTimeoutMs;
      const attempt = (): void => {
        if (childExit) {
          reject(new Error(`engine exited (code ${childExit.code ?? 'null'}, signal ${childExit.signal ?? 'none'}) before accepting a connection`));
          return;
        }
        const socket = connect(port, '127.0.0.1');
        const onError = (error: Error): void => {
          socket.destroy();
          if (now() >= deadline) {
            reject(new Error(`engine did not accept a connection on port ${port} within ${timing.connectTimeoutMs} ms: ${error.message}`));
            return;
          }
          setTimeout(attempt, timing.connectRetryMs);
        };
        socket.once('error', onError);
        socket.once('connect', () => {
          socket.removeListener('error', onError);
          resolve(socket);
        });
      };
      attempt();
    });

  const startEngine = async (): Promise<void> => {
    const enginePort = await pickEphemeralPort(createServer);
    const [command, ...rest] = config.engineCommand;
    const args = [...rest, '--port', String(enginePort)];
    let stdinFd: number | undefined;
    if (config.stdinFile) {
      stdinFd = openStdinFile(config.stdinFile);
    }
    logger.info(`spawning engine: ${command} ${args.join(' ')}${config.stdinFile ? ` (stdin from ${config.stdinFile})` : ''}`);
    child = spawnFn(command, args, { stdio: [stdinFd ?? 'ignore', 'inherit', 'inherit'], windowsHide: true });
    if (stdinFd !== undefined) {
      // The child holds its own copy of the descriptor now.
      closeFd(stdinFd);
    }
    child.on('exit', (code, signal) => {
      childExit = { code, signal };
      logger.info(`engine exited: code ${code ?? 'null'}, signal ${signal ?? 'none'}`);
      onEngineGone();
    });
    child.on('error', (error) => {
      logger.error('engine spawn error', error);
      childExit = childExit ?? { code: 1, signal: null };
      onEngineGone();
    });
    const socket = await connectWithRetry(enginePort);
    logger.info(`connected to engine on port ${enginePort}`);
    engine = new EngineClient<ForwardMeta>(
      socket,
      logger,
      {
        onMessage: (message) => router?.onEngineMessage(message),
        onClose: () => {
          logger.info('engine socket closed');
          router?.onEngineClosed();
          onEngineDrained?.();
          onEngineGone();
        }
      },
      timing.engineRequestTimeoutMs
    );
    if (!client) {
      return;
    }
    router = new Router(
      state,
      engine,
      client,
      logger,
      {
        onDisconnectRequested: () => {
          logger.info('client requested disconnect/terminate');
          if (!shuttingDown) {
            shuttingDown = true;
            waitForEngineThenFinish(() => (childExit ? (childExit.code ?? 0) : 0));
          }
        },
        onFatal: fatal
      },
      { platform, arch }
    );
    for (const message of pendingClientMessages.splice(0)) {
      router.onClientMessage(message);
    }
  };

  const onConnection = (socket: net.Socket): void => {
    if (client) {
      logger.warn('second client connection refused');
      socket.destroy();
      return;
    }
    logger.info('client connected');
    client = new ClientConnection(socket, logger, {
      onMessage: (message) => {
        if (router) {
          router.onClientMessage(message);
        } else {
          pendingClientMessages.push(message);
        }
      },
      onClose: () => {
        onClientDrained?.();
        onClientClosed();
      }
    });
    startEngine().catch((error: unknown) => {
      logger.error('engine start failed', error);
      if (!shuttingDown) {
        shuttingDown = true;
        killEngine();
        finish(1);
      }
    });
  };

  const server = createServer(onConnection);
  const ready = new Promise<void>((resolve, reject) => {
    server.once('error', (error) => {
      // A port that cannot be taken (already in use, or refused) leaves nothing to serve:
      // exit rather than idle as a zombie the adapter would wait on until its own timeout.
      logger.error('listen failed', error);
      reject(error);
      shuttingDown = true;
      exitNow(1);
    });
    server.listen(config.listenPort, '127.0.0.1', () => {
      logger.info(`listening on 127.0.0.1:${port()}`);
      resolve();
    });
  });
  ready.catch(() => undefined);

  const port = (): number => {
    const address = server.address();
    return typeof address === 'object' && address ? address.port : config.listenPort;
  };

  const cleanup = (): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    killEngine();
    finish(0);
  };

  return { server, ready, port, cleanup };
}

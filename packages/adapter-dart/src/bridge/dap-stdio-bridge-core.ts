/**
 * TCP ↔ stdio bridge for stdio-only DAP servers (`dart debug_adapter`, `flutter debug-adapter`).
 *
 * The proxy worker only connects to debug adapters over TCP. This bridge listens on a loopback
 * port, spawns the real adapter on the first connection, and pipes bytes both ways without
 * parsing them. Design points (several learned from the netcoredbg bridge):
 *
 * - the socket is ended on the child's `close` event, never on `exit` — the last DAP frames can
 *   still be in the stdout pipe after `exit`;
 * - the child's stderr goes to the bridge's own stderr (the proxy's adapter manager line-buffers
 *   and sanitises it) and never into the DAP stream;
 * - a spawn failure is reported on stderr, ends the socket, and sets a non-zero exit code;
 * - exactly one client is served; later connections are refused.
 *
 * This file has no dependencies outside Node so it can be bundled into one self-contained script.
 */
import { spawn as nodeSpawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import net from 'node:net';
import type { Writable } from 'node:stream';

export interface BridgeArgs {
  port: number;
  host?: string;
  cwd?: string;
  command: string;
  args: string[];
}

export interface BridgeOptions extends BridgeArgs {
  /** Injected for tests; defaults to `child_process.spawn`. */
  spawnFn?: (command: string, args: string[], options: SpawnOptions) => ChildProcess;
  /** Where the child's stderr and the bridge's own diagnostics go; defaults to `process.stderr`. */
  stderr?: Writable;
  env?: NodeJS.ProcessEnv;
}

export interface BridgeHandle {
  readonly port: number;
  readonly listening: boolean;
  /** Set once the child has exited (its exit code) or could not be spawned (1). */
  readonly exitCode: number | undefined;
  /** Resolves when the server has closed and the child (if any) was asked to stop. */
  close(): Promise<void>;
  /** Resolves with the exit code when the session is over (child closed or spawn failed). */
  readonly done: Promise<number>;
}

/** `--port N [--host H] [--cwd D] -- <command> [args…]` */
export function parseBridgeArgs(argv: string[]): BridgeArgs {
  const sep = argv.indexOf('--');
  if (sep < 0 || sep === argv.length - 1) {
    throw new Error('usage: dap-stdio-bridge --port <port> [--host <host>] [--cwd <dir>] -- <command> [args...]');
  }
  const own = argv.slice(0, sep);
  const child = argv.slice(sep + 1);
  const out: Partial<BridgeArgs> = { command: child[0], args: child.slice(1) };
  for (let i = 0; i < own.length; i++) {
    const key = own[i];
    const value = own[i + 1];
    if (key === '--port') { out.port = Number(value); i++; }
    else if (key === '--host') { out.host = value; i++; }
    else if (key === '--cwd') { out.cwd = value; i++; }
    else throw new Error(`unknown bridge option ${key}`);
  }
  if (out.port === undefined || !Number.isInteger(out.port) || out.port < 0) {
    throw new Error('dap-stdio-bridge: --port <port> is required');
  }
  return out as BridgeArgs;
}

export function createBridge(options: BridgeOptions): Promise<BridgeHandle> {
  const spawnFn = options.spawnFn ?? nodeSpawn;
  const stderr = options.stderr ?? process.stderr;
  const host = options.host ?? '127.0.0.1';
  const log = (line: string): void => { stderr.write(`[dap-stdio-bridge] ${line}\n`); };

  let child: ChildProcess | undefined;
  let socket: net.Socket | undefined;
  let exitCode: number | undefined;
  let resolveDone!: (code: number) => void;
  const done = new Promise<number>((resolve) => { resolveDone = resolve; });
  const finish = (code: number): void => {
    if (exitCode !== undefined) return;
    exitCode = code;
    resolveDone(code);
  };

  const server = net.createServer((conn) => {
    if (socket) {
      log('refusing a second client');
      conn.destroy();
      return;
    }
    socket = conn;
    conn.setNoDelay(true);
    log(`client connected; spawning ${options.command} ${options.args.join(' ')}`);
    try {
      child = spawnFn(options.command, options.args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (err) {
      log(`spawn failed: ${(err as Error).message}`);
      finish(1);
      conn.end();
      server.close();
      return;
    }
    const cp = child;

    cp.on('error', (err: NodeJS.ErrnoException) => {
      log(`${options.command}: ${err.message}`);
      finish(1);
      conn.end();
      server.close();
    });

    // stderr → our stderr, line by line, never into the DAP stream.
    let errBuf = '';
    cp.stderr?.on('data', (chunk: Buffer) => {
      errBuf += chunk.toString('utf8');
      let idx: number;
      while ((idx = errBuf.indexOf('\n')) >= 0) {
        stderr.write(errBuf.slice(0, idx + 1));
        errBuf = errBuf.slice(idx + 1);
      }
    });
    cp.stderr?.on('end', () => { if (errBuf) { stderr.write(errBuf + '\n'); errBuf = ''; } });

    // Byte-transparent piping both ways. Nothing is written to a child that has ended: the
    // Flutter adapter exits by itself right after terminate/disconnect (measured) while the
    // proxy's follow-up request is still on its way, and a write to the dead pipe raises EPIPE.
    let childEnded = false;
    cp.stdin?.on('error', (err: NodeJS.ErrnoException) => { log(`adapter stdin: ${err.message}`); });
    conn.on('data', (chunk: Buffer) => {
      if (!childEnded && cp.stdin && !cp.stdin.destroyed && cp.stdin.writable) cp.stdin.write(chunk);
    });
    cp.stdout?.on('data', (chunk: Buffer) => { if (!conn.destroyed) conn.write(chunk); });

    cp.on('exit', () => { childEnded = true; });
    cp.on('close', (code, signal) => {
      childEnded = true;
      log(`adapter closed code=${code} signal=${signal}`);
      finish(code ?? (signal ? 1 : 0));
      conn.end();
      server.close();
    });

    const onSocketGone = (): void => {
      socket = undefined;
      try { cp.stdin?.end(); } catch { /* already closed */ }
      if ((cp.exitCode ?? null) === null && !cp.killed) {
        try { cp.kill(); } catch { /* already gone */ }
      }
      server.close();
    };
    conn.on('close', onSocketGone);
    conn.on('error', (err) => { log(`socket error: ${err.message}`); });
  });

  return new Promise<BridgeHandle>((resolve, reject) => {
    server.once('error', (err) => { log(`listen failed: ${err.message}`); reject(err); });
    server.listen(options.port, host, () => {
      const addr = server.address() as net.AddressInfo;
      resolve({
        get port() { return addr.port; },
        get listening() { return server.listening; },
        get exitCode() { return exitCode; },
        done,
        close: () => new Promise<void>((res) => {
          try { socket?.destroy(); } catch { /* ignore */ }
          if (child && child.exitCode === null && !child.killed) { try { child.kill(); } catch { /* ignore */ } }
          if (!server.listening) { res(); return; }
          server.close(() => res());
        }),
      });
    });
  });
}

/**
 * DAP-level tests for the mock adapter process (issue #355): function
 * breakpoints must stop with reason 'function breakpoint' and carry
 * hitBreakpointIds; line breakpoints keep reason 'breakpoint' (and also
 * carry hitBreakpointIds). When a line breakpoint and a function breakpoint
 * bind to the same line, the plain line breakpoint wins the tiebreak.
 *
 * The tests spawn the compiled adapter process in TCP mode and speak DAP
 * over the socket (building the package first if dist is missing).
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { spawn, execSync, ChildProcess } from 'child_process';
import net from 'net';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import type { DebugProtocol } from '@vscode/debugprotocol';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROCESS_JS = path.join(PKG_ROOT, 'dist', 'mock-adapter-process.js');

class DapTestClient {
  private socket!: net.Socket;
  private buffer = Buffer.alloc(0);
  private seq = 1;
  private pending = new Map<number, (r: DebugProtocol.Response) => void>();
  readonly events: DebugProtocol.Event[] = [];
  private eventWaiters: Array<{
    match: (e: DebugProtocol.Event) => boolean;
    resolve: (e: DebugProtocol.Event) => void;
  }> = [];

  async connect(port: number): Promise<void> {
    // The process needs a moment to open its TCP listener
    const deadline = Date.now() + 10_000;
    for (;;) {
      try {
        await new Promise<void>((resolve, reject) => {
          const s = net.connect(port, '127.0.0.1');
          s.once('connect', () => {
            this.socket = s;
            resolve();
          });
          s.once('error', reject);
        });
        break;
      } catch (err) {
        if (Date.now() > deadline) throw err;
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    this.socket.on('data', (chunk) => this.onData(chunk));
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;
      const header = this.buffer.subarray(0, headerEnd).toString('utf8');
      const m = header.match(/Content-Length: (\d+)/);
      if (!m) {
        this.buffer = this.buffer.subarray(headerEnd + 4);
        continue;
      }
      const len = parseInt(m[1], 10);
      if (this.buffer.length < headerEnd + 4 + len) break;
      const body = this.buffer.subarray(headerEnd + 4, headerEnd + 4 + len).toString('utf8');
      this.buffer = this.buffer.subarray(headerEnd + 4 + len);
      const msg = JSON.parse(body) as DebugProtocol.ProtocolMessage;
      if (msg.type === 'response') {
        const resp = msg as DebugProtocol.Response;
        const resolve = this.pending.get(resp.request_seq);
        if (resolve) {
          this.pending.delete(resp.request_seq);
          resolve(resp);
        }
      } else if (msg.type === 'event') {
        const event = msg as DebugProtocol.Event;
        this.events.push(event);
        this.eventWaiters = this.eventWaiters.filter((w) => {
          if (w.match(event)) {
            w.resolve(event);
            return false;
          }
          return true;
        });
      }
    }
  }

  request<T extends DebugProtocol.Response>(command: string, args?: unknown): Promise<T> {
    const seq = this.seq++;
    const json = JSON.stringify({ seq, type: 'request', command, arguments: args });
    this.socket.write(`Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`);
    return new Promise((resolve) => {
      this.pending.set(seq, resolve as (r: DebugProtocol.Response) => void);
    });
  }

  waitForEvent(name: string, timeoutMs = 5000): Promise<DebugProtocol.Event> {
    const existing = this.events.find((e) => e.event === name);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Timed out waiting for '${name}' event`)),
        timeoutMs
      );
      this.eventWaiters.push({
        match: (e) => e.event === name,
        resolve: (e) => {
          clearTimeout(timer);
          resolve(e);
        },
      });
    });
  }

  close(): void {
    this.socket?.destroy();
  }
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

describe('mock-adapter-process stopped events (issue #355)', () => {
  let child: ChildProcess | undefined;
  let client: DapTestClient | undefined;

  beforeAll(() => {
    if (!fs.existsSync(PROCESS_JS)) {
      execSync('npx tsc -b', { cwd: PKG_ROOT, stdio: 'inherit' });
    }
  }, 120_000);

  afterEach(() => {
    client?.close();
    client = undefined;
    if (child && !child.killed) child.kill('SIGKILL');
    child = undefined;
  });

  async function startSession(): Promise<DapTestClient> {
    const port = await getFreePort();
    // Bind explicitly to 127.0.0.1: the process's default host 'localhost'
    // can resolve to ::1 on CI runners while the client dials 127.0.0.1.
    child = spawn(process.execPath, [PROCESS_JS, '--port', String(port), '--host', '127.0.0.1'], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    client = new DapTestClient();
    await client.connect(port);
    await client.request('initialize', { adapterID: 'mock' });
    return client;
  }

  it("stops with reason 'function breakpoint' and hitBreakpointIds when a function breakpoint is hit", async () => {
    const c = await startSession();

    const fbResp = await c.request<DebugProtocol.SetFunctionBreakpointsResponse>(
      'setFunctionBreakpoints',
      { breakpoints: [{ name: 'compute' }] }
    );
    expect(fbResp.success).toBe(true);
    const fnBp = fbResp.body.breakpoints[0];
    expect(fnBp.verified).toBe(true);
    expect(fnBp.line).toBe(10);

    await c.request('launch', { program: '/tmp/mock-program.py', stopOnEntry: false });

    const stopped = (await c.waitForEvent('stopped')) as DebugProtocol.StoppedEvent;
    expect(stopped.body.reason).toBe('function breakpoint');
    expect(stopped.body.hitBreakpointIds).toEqual([fnBp.id]);
  }, 15_000);

  it("keeps reason 'breakpoint' (with hitBreakpointIds) for plain line breakpoints", async () => {
    const c = await startSession();

    const bpResp = await c.request<DebugProtocol.SetBreakpointsResponse>('setBreakpoints', {
      source: { path: '/tmp/mock-program.py' },
      breakpoints: [{ line: 7 }],
    });
    expect(bpResp.success).toBe(true);
    const lineBp = bpResp.body.breakpoints[0];

    await c.request('launch', { program: '/tmp/mock-program.py', stopOnEntry: false });

    const stopped = (await c.waitForEvent('stopped')) as DebugProtocol.StoppedEvent;
    expect(stopped.body.reason).toBe('breakpoint');
    expect(stopped.body.hitBreakpointIds).toEqual([lineBp.id]);
  }, 15_000);

  it("prefers reason 'breakpoint' when a line and a function breakpoint share a line", async () => {
    const c = await startSession();

    // 'compute' binds to line 10 per the mock's function table; put a line
    // breakpoint on the same line.
    const bpResp = await c.request<DebugProtocol.SetBreakpointsResponse>('setBreakpoints', {
      source: { path: '/tmp/mock-program.py' },
      breakpoints: [{ line: 10 }],
    });
    const lineBp = bpResp.body.breakpoints[0];
    await c.request('setFunctionBreakpoints', { breakpoints: [{ name: 'compute' }] });

    await c.request('launch', { program: '/tmp/mock-program.py', stopOnEntry: false });

    const stopped = (await c.waitForEvent('stopped')) as DebugProtocol.StoppedEvent;
    expect(stopped.body.reason).toBe('breakpoint');
    expect(stopped.body.hitBreakpointIds).toEqual([lineBp.id]);
  }, 15_000);

  it("reports 'function breakpoint' on the continue path too", async () => {
    const c = await startSession();

    const bpResp = await c.request<DebugProtocol.SetBreakpointsResponse>('setBreakpoints', {
      source: { path: '/tmp/mock-program.py' },
      breakpoints: [{ line: 3 }],
    });
    const lineBp = bpResp.body.breakpoints[0];
    const fbResp = await c.request<DebugProtocol.SetFunctionBreakpointsResponse>(
      'setFunctionBreakpoints',
      { breakpoints: [{ name: 'compute' }] }
    );
    const fnBp = fbResp.body.breakpoints[0];

    await c.request('launch', { program: '/tmp/mock-program.py', stopOnEntry: false });

    // First stop: the line breakpoint at line 3.
    const first = (await c.waitForEvent('stopped')) as DebugProtocol.StoppedEvent;
    expect(first.body.reason).toBe('breakpoint');
    expect(first.body.hitBreakpointIds).toEqual([lineBp.id]);

    // Continue: next stop is the function breakpoint at line 10.
    c.events.length = 0;
    await c.request('continue', { threadId: 1 });
    const second = (await c.waitForEvent('stopped')) as DebugProtocol.StoppedEvent;
    expect(second.body.reason).toBe('function breakpoint');
    expect(second.body.hitBreakpointIds).toEqual([fnBp.id]);
  }, 15_000);
});

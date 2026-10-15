/** A test-owned child transport: EOF asks the supervisor to exit without SDK kill timers. */
import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'node:child_process';
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { FORCE_EXIT_DELAY_MS } from '../../../tools/dev-proxy/shutdown.mjs';

export class OwnedStdioTransport implements Transport {
  readonly child: ChildProcessWithoutNullStreams;
  readonly closed: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: Transport['onmessage'];
  private readonly buffer = new ReadBuffer();
  private closing?: Promise<void>;
  private finished = false;
  fallbackKills = 0;

  constructor(command: string, args: string[], options: SpawnOptionsWithoutStdio) {
    this.child = spawn(command, args, { ...options, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.closed = new Promise(resolve => {
      this.child.once('close', (code, signal) => {
        this.finished = true;
        this.buffer.clear();
        resolve({ code, signal });
        this.onclose?.();
      });
    });
    this.child.on('error', error => this.onerror?.(error));
    this.child.stdin.on('error', error => this.onerror?.(error));
  }

  get pid() { return this.child.pid ?? null; }
  get stderr() { return this.child.stderr; }

  async start(): Promise<void> {
    this.child.stdout.on('data', (chunk: Buffer) => {
      try {
        this.buffer.append(chunk);
        for (let message = this.buffer.readMessage(); message !== null; message = this.buffer.readMessage()) {
          this.onmessage?.(message);
        }
      } catch (error) {
        this.onerror?.(error as Error);
      }
    });
    this.child.stdout.on('error', error => this.onerror?.(error));
  }

  send(message: JSONRPCMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      this.child.stdin.write(serializeMessage(message), error => error ? reject(error) : resolve());
    });
  }

  close(): Promise<void> {
    this.closing ??= this.closeFromEof();
    return this.closing;
  }

  private async closeFromEof(): Promise<void> {
    if (!this.finished) this.child.stdin.end();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const outcome = await Promise.race([
        this.closed,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            this.fallbackKills++;
            this.child.kill('SIGKILL');
            reject(new Error(`Proxy did not close after EOF within its ${FORCE_EXIT_DELAY_MS}ms shutdown deadline; test fallback kill used`));
          }, FORCE_EXIT_DELAY_MS);
        }),
      ]);
      if (outcome.code !== 0 || outcome.signal !== null) {
        throw new Error(`Proxy exited abnormally after EOF: ${JSON.stringify(outcome)}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}

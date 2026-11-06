/**
 * js-debug injects a host-local bootloader path and IPC address into an
 * attached process when child auto-attach is enabled. A loopback inspector
 * can be a port-forward to another filesystem: injecting there makes every
 * later Node child fail its preload. Prove shared temporary storage before
 * enabling this by default; a host name or matching PID is not that proof.
 */
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { probeInspector } from './inspector-activation.js';

interface ProbeSocket {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
}

interface ChildAttachLocalityOptions {
  host: string;
  port?: number;
  websocketAddress?: string;
  /** Directory of the exact vendored adapter selected by buildAdapterCommand. */
  adapterDirectory?: string;
  timeoutMs?: number;
}

/** false includes an unavailable, paused, or older inspector that cannot prove locality. */
export async function canAutoAttachChildren(options: ChildAttachLocalityOptions): Promise<boolean> {
  const timeoutMs = options.timeoutMs ?? 1500;
  const WebSocketImpl = (globalThis as { WebSocket?: new (url: string) => ProbeSocket }).WebSocket;
  if (!WebSocketImpl || !options.adapterDirectory) return false;
  let address = options.websocketAddress;
  if (!address && options.port !== undefined) {
    try {
      const probe = await probeInspector(options.host, options.port, timeoutMs);
      if (probe.status !== 'inspector') return false;
      address = probe.targets.find(target => target?.type === 'node')?.webSocketDebuggerUrl;
    } catch {
      return false;
    }
  }
  if (!address) return false;

  const nonce = randomUUID();
  const file = join(tmpdir(), `debug-mcp-child-attach-${nonce}`);
  let created = false;
  try {
    await writeFile(file, nonce, { flag: 'wx', mode: 0o600 });
    created = true;
    // getBuiltinModule works in both ESM and CJS on recent Node; require
    // covers older CJS targets, import covers older ESM where supported by
    // the inspector. Failure is a conservative opt-out; no debuggee code is
    // resumed and its environment is unchanged. Sharing /tmp alone is not
    // enough: a sidecar may share it without sharing the adapter installation.
    const requiredFiles = ['bootloader.js', 'watchdog.js'].map(name => join(options.adapterDirectory!, name));
    const expression = `(async()=>{try{const fs=typeof process.getBuiltinModule==='function'?process.getBuiltinModule('node:fs'):typeof require==='function'?require('node:fs'):await import('node:fs');for(const p of ${JSON.stringify(requiredFiles)})fs.accessSync(p,fs.constants.R_OK);return fs.readFileSync(${JSON.stringify(file)},'utf8')===${JSON.stringify(nonce)}}catch{return false}})()`;
    return await new Promise<boolean>((resolve) => {
      let socket: ProbeSocket | undefined;
      let settled = false;
      const finish = (shared: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { socket?.close(); } catch { /* already closed */ }
        resolve(shared);
      };
      const timer = setTimeout(() => finish(false), timeoutMs);
      try {
        socket = new WebSocketImpl(address);
        socket.onopen = () => {
          try {
            socket!.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
          } catch { finish(false); }
        };
        socket.onmessage = (event) => {
          try {
            const reply = JSON.parse(String(event.data)) as { id?: number; result?: { result?: { value?: unknown }; exceptionDetails?: unknown } };
            if (reply.id === 1) finish(!reply.result?.exceptionDetails && reply.result?.result?.value === true);
          } catch { finish(false); }
        };
        socket.onerror = () => finish(false);
        socket.onclose = () => finish(false);
      } catch { finish(false); }
    });
  } catch {
    return false;
  } finally {
    if (created) await unlink(file).catch(() => {});
  }
}

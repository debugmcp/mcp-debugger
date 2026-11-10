/**
 * The stdio transport speaks both protocol eras (issue #1025, step 2): a
 * 2026-07-28 client's server/discover probe is answered, so Claude Code's v2
 * runtime (which probes every stdio server) lands on the modern era; a client
 * that opens with initialize gets the 2025-11-25 era as before. Real server
 * (`dist/index.js stdio`), the v2 SDK client in each negotiation mode, the
 * mock adapter — no toolchain.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { serverEnvironment } from '../../test-utils/helpers/mcp-stdio-client.js';
import { TOOL_NAMES } from '../../../src/server/tool-schemas.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const entry = path.join(root, 'dist/index.js');
const MOCK_SCRIPT = path.join(root, 'examples/python/simple_test.py');

type Mode = 'auto' | 'legacy' | { pin: string };

interface Answer {
  success: boolean;
  sessionId?: string;
  state?: string;
  message?: string;
  error?: string;
}

const clients: Client[] = [];

async function connect(mode: Mode, name: string): Promise<Client> {
  const client = new Client({ name, version: '1.0.0' }, { versionNegotiation: { mode } });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entry, 'stdio'],
    cwd: root,
    env: serverEnvironment(),
    stderr: 'pipe'
  });
  transport.stderr?.on('data', () => {});
  await client.connect(transport);
  clients.push(client);
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}): Promise<Answer> {
  const raw = await client.callTool({ name, arguments: args }, { timeout: 30_000 });
  const text = (raw.content as Array<{ type: string; text?: string }>).find((item) => item.type === 'text')?.text;
  expect(text, JSON.stringify(raw)).toBeDefined();
  return JSON.parse(text!) as Answer;
}

afterEach(async () => {
  for (const client of clients.splice(0)) {
    await client.close().catch(() => {});
  }
});

describe('stdio serves both protocol eras (issue #1025, step 2)', () => {
  it('a probing client (Claude Code\'s posture) lands on 2026-07-28', async () => {
    const client = await connect('auto', 'era-auto');

    expect(client.getProtocolEra()).toBe('modern');
    expect(client.getNegotiatedProtocolVersion()).toBe('2026-07-28');
    expect(client.getServerVersion()?.name).toBe('debug-mcp-server');
    expect((await client.listTools()).tools.length).toBe(TOOL_NAMES.length);
  }, 60_000);

  it('a client pinned to 2026-07-28 drives a full debug session and hears list changes on its listen stream', async () => {
    const client = await connect({ pin: '2026-07-28' }, 'era-pin');
    expect(client.getProtocolEra()).toBe('modern');

    const changes: string[] = [];
    client.setNotificationHandler('notifications/resources/list_changed', () => { changes.push('list_changed'); });
    const subscription = await client.listen({ resourcesListChanged: true });
    expect(subscription.honoredFilter.resourcesListChanged).toBe(true);

    const created = await call(client, 'create_debug_session', { language: 'mock', name: 'era-pin' });
    expect(created.success, JSON.stringify(created)).toBe(true);
    const sessionId = created.sessionId!;
    await expect.poll(() => changes.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);

    const bp = await call(client, 'set_breakpoint', { sessionId, file: MOCK_SCRIPT, line: 32 });
    expect(bp.success, JSON.stringify(bp)).toBe(true);
    const started = await call(client, 'start_debugging', { sessionId, scriptPath: MOCK_SCRIPT, dapLaunchArgs: { stopOnEntry: true } });
    expect(started.success, JSON.stringify(started)).toBe(true);
    const waited = await call(client, 'wait_for_stop', { sessionId, timeout: 15_000 });
    expect(waited.success, JSON.stringify(waited)).toBe(true);
    expect(waited.state).toBe('paused');
    expect((await call(client, 'close_debug_session', { sessionId })).success).toBe(true);

    await subscription.close();
  }, 90_000);

  it('a client that opens with initialize gets the 2025-11-25 era, as before', async () => {
    const client = await connect('legacy', 'era-legacy');

    expect(client.getProtocolEra()).toBe('legacy');
    expect(client.getNegotiatedProtocolVersion()).toBe('2025-11-25');
    const created = await call(client, 'create_debug_session', { language: 'mock', name: 'era-legacy' });
    expect(created.success).toBe(true);
    // The legacy subscription API still works on a legacy pin.
    await client.subscribeResource({ uri: `debug://sessions/${created.sessionId}/output` });
    expect((await call(client, 'close_debug_session', { sessionId: created.sessionId! })).success).toBe(true);
  }, 60_000);

  it('a raw server/discover line on stdin names 2026-07-28 among the supported versions', async () => {
    const child = spawn(process.execPath, [entry, 'stdio'], { cwd: root, env: serverEnvironment(), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    try {
      const frames: Array<{ id?: number; result?: { supportedVersions?: string[] } }> = [];
      let buffer = '';
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try { frames.push(JSON.parse(line)); } catch { /* not a frame */ }
        }
      });
      child.stdin.write(`${JSON.stringify({
        jsonrpc: '2.0',
        id: 7,
        method: 'server/discover',
        params: {
          _meta: {
            'io.modelcontextprotocol/protocolVersion': '2026-07-28',
            'io.modelcontextprotocol/clientInfo': { name: 'raw-probe', version: '1.0.0' },
            'io.modelcontextprotocol/clientCapabilities': {}
          }
        }
      })}\n`);

      await expect.poll(() => frames.find((frame) => frame.id === 7), { timeout: 20_000 }).toBeDefined();
      const answer = frames.find((frame) => frame.id === 7)!;
      expect(answer.result?.supportedVersions).toContain('2026-07-28');
    } finally {
      child.kill();
    }
  }, 30_000);
});

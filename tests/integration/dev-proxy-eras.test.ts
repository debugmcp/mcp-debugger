/**
 * The dev proxy on both protocol eras (issue #1025, step 2, PR 5), driven as
 * Claude Code drives it: a v2 client over the SDK's own StdioClientTransport.
 *
 * In `auto` mode that client probes server/discover on a DISPOSABLE SIBLING
 * process spawned from the same parameters, then starts the real one. Measured
 * before this change: the sibling ran the proxy's eager backend start too —
 * two backends per connect, both racing ensurePortFree on one port. Now the
 * backend starts on the first request that reaches a handler, which a probe
 * never is.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const root = path.resolve(__dirname, '../..');
const devTools = ['dev_restart_debugger', 'dev_rebuild_and_restart', 'dev_server_status'];
const clients: Client[] = [];
const directories: string[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) await client.close().catch(() => undefined);
  for (const dir of directories.splice(0)) await rm(dir, { recursive: true, force: true });
});

type Mode = 'auto' | 'legacy' | { pin: '2026-07-28' };

async function connect(mode: Mode, env: Record<string, string> = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mcp-proxy-eras-'));
  directories.push(dir);
  const events = path.join(dir, 'events.ndjson');
  const client = new Client({ name: 'eras-test', version: '1.0.0' }, { versionNegotiation: { mode } });
  clients.push(client);
  // The SDK's base transport, exactly as Claude Code uses it: the sibling path
  // runs only for the base class (a subclass probes in place).
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(root, 'tools/dev-proxy/dev-proxy.mjs')],
    cwd: root,
    env: {
      ...process.env,
      DEV_PROXY_ROOT: root,
      DEV_PROXY_BACKEND_TRANSPORT: 'stdio',
      DEV_PROXY_BACKEND_CMD: `"${process.execPath}" "${path.join(root, 'tests/fixtures/dev-proxy/startup-backend.mjs')}"`,
      DEV_PROXY_FIXTURE_EVENTS: events,
      DEV_PROXY_FIXTURE_FAIL: '0',
      DEV_PROXY_FIXTURE_RELEASE: '',
      DEV_PROXY_FIXTURE_TOOL: 'fixture_tool',
      ...env,
    },
    stderr: 'pipe',
  });
  transport.stderr?.on('data', () => {});
  await client.connect(transport);
  const backendStarts = async () => (await readFile(events, 'utf8').catch(() => ''))
    .split('\n').filter((line) => line.includes('"backend-start"')).length;
  return { client, backendStarts };
}

describe('dev-proxy protocol eras (issue #1025, step 2)', () => {
  it('an auto-negotiating client lands on 2026-07-28, and only the real connection starts a backend, on its first request', async () => {
    const { client, backendStarts } = await connect('auto');

    expect(client.getProtocolEra()).toBe('modern');
    expect(client.getNegotiatedProtocolVersion()).toBe('2026-07-28');
    // The sibling probe and the real connect have both happened; neither started a backend.
    // (An eager sibling start might not have appended its event yet, so this first read is
    // a probabilistic detector; the two reads below are the deterministic ones.)
    expect(await backendStarts()).toBe(0);

    const status = await client.callTool({ name: 'dev_server_status', arguments: {} });
    const text = (status.content as Array<{ text: string }>)[0].text;
    // "stopped" alone reads like a crash; before the first start the status says why.
    expect(JSON.parse(text)).toMatchObject({
      state: 'stopped',
      protocolEra: null,
      note: expect.stringContaining('starts on the first request that needs it'),
    });
    expect(await backendStarts()).toBe(0);

    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name)).toEqual(['fixture_tool', ...devTools]);
    expect(await backendStarts()).toBe(1);

    // The fixture backend is a 2025 server: the status says which era the backend speaks.
    const after = await client.callTool({ name: 'dev_server_status', arguments: {} });
    const running = JSON.parse((after.content as Array<{ text: string }>)[0].text);
    expect(running).toMatchObject({ state: 'running', protocolEra: 'legacy', protocolVersion: '2025-11-25' });
    expect(running).not.toHaveProperty('note');
  });

  it('a 2025 client keeps working unchanged', async () => {
    const { client, backendStarts } = await connect('legacy');

    expect(client.getProtocolEra()).toBe('legacy');
    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(['fixture_tool', ...devTools]);
    expect(await backendStarts()).toBe(1);
  });

  // The proxy is itself a v2 client of its backend. Over stdio the SDK's `auto`
  // mode probes on a disposable sibling process for its base transport — a second
  // backend — so the proxy used to pin a stdio backend to the 2025 era and never
  // exercise the server's modern stdio leg. A subclassed transport probes in place
  // (documented SDK behaviour): one process, and a legacy server falls back to
  // `initialize` on the same pipe, which the first case above pins (the fixture
  // is a 2025 server: one start, era legacy).
  it('negotiates with a stdio backend in place: the real server lands on 2026-07-28, started once', async () => {
    const { client, backendStarts } = await connect('legacy', {
      DEV_PROXY_BACKEND_CMD: `"${process.execPath}" "${path.join(root, 'tests/fixtures/dev-proxy/real-backend.mjs')}"`,
    });

    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining(['create_debug_session', ...devTools]));

    const status = await client.callTool({ name: 'dev_server_status', arguments: {} });
    expect(JSON.parse((status.content as Array<{ text: string }>)[0].text)).toMatchObject({
      state: 'running', backendTransport: 'stdio', protocolEra: 'modern', protocolVersion: '2026-07-28',
    });
    expect(await backendStarts()).toBe(1);
  }, 60_000);

  it('a 2026-07-28 client hears a backend resources/updated on its listen stream through the relay', async () => {
    const { client } = await connect({ pin: '2026-07-28' });
    const updated: string[] = [];
    client.setNotificationHandler('notifications/resources/updated', async (n) => { updated.push(n.params.uri); });
    await client.listTools();
    const subscription = await client.listen({ resourceSubscriptions: ['fixture://status'] });

    // The fixture backend (2025) sends resources/updated for a touched URI only
    // if the proxy subscribed it. A 2026 client's listen set is served by the SDK
    // entry and never reaches the proxy, so while a 2026 client is pinned the
    // proxy subscribes the backend to every resource it lists; the front's own
    // router then delivers only what this client listened for.
    const touched = await client.callTool({ name: 'fixture_tool', arguments: { touch: 'fixture://status' } });
    expect(touched.isError, JSON.stringify(touched.content)).not.toBe(true);
    await expect.poll(() => updated, { timeout: 5000 }).toEqual(['fixture://status']);
    await subscription.close();
  });
});

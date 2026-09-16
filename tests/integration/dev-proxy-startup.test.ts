import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const devTools = ['dev_restart_debugger', 'dev_rebuild_and_restart', 'dev_server_status'];
const clients: Client[] = [];
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map(client => client.close()));
  await Promise.all(directories.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

/**
 * Attach handlers now rather than at the first await. If an assertion in
 * between throws, `afterEach`'s `client.close()` rejects the in-flight request
 * and vitest reports an unhandled ConnectionClosed on top of the real failure.
 */
function observe<T>(promise: Promise<T>): Promise<{ result?: T; error?: unknown }> {
  return promise.then(result => ({ result }), (error: unknown) => ({ error }));
}

async function connect(env: Record<string, string> = {}) {
  const client = new Client({ name: 'startup-test', version: '1.0.0' });
  clients.push(client);
  const notifications: string[] = [];
  client.setNotificationHandler(ToolListChangedNotificationSchema, async (notification) => {
    notifications.push(notification.method);
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(root, 'tools/dev-proxy/dev-proxy.mjs')],
    cwd: root,
    env: {
      ...process.env,
      DEV_PROXY_ROOT: root,
      DEV_PROXY_BACKEND_TRANSPORT: 'stdio',
      DEV_PROXY_BACKEND_CMD: `"${process.execPath}" "${path.join(root, 'tests/fixtures/dev-proxy/startup-backend.mjs')}"`,
      DEV_PROXY_FIXTURE_FAIL: '0',
      DEV_PROXY_FIXTURE_RELEASE: '',
      DEV_PROXY_FIXTURE_TOOL: 'fixture_tool',
      ...env,
    },
    stderr: 'pipe',
  });
  transport.stderr?.on('data', () => {});
  await client.connect(transport);
  return { client, notifications };
}

describe('dev-proxy initial tool discovery (issue #716)', () => {
  it('waits for delayed startup on the first tools/list while keeping status callable', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mcp-proxy-startup-'));
    directories.push(dir);
    const releaseFile = path.join(dir, 'ready');
    const { client } = await connect({ DEV_PROXY_FIXTURE_RELEASE: releaseFile });

    const firstTools = observe(client.listTools());
    const status = await client.callTool({ name: 'dev_server_status', arguments: {} });
    expect(status.content).toEqual([expect.objectContaining({ text: expect.stringContaining('"starting"') })]);
    await writeFile(releaseFile, 'ready');

    const listed = await firstTools;
    expect(listed.error).toBeUndefined();
    expect(listed.result?.tools.map(tool => tool.name)).toEqual(['fixture_tool', ...devTools]);
  });

  it('answers the first tools/list as soon as an http backend dies at spawn', async () => {
    // Its own port: the proxy force-kills whichever node process holds the
    // configured one, and the default 3001 is a live developer backend.
    const startedAt = Date.now();
    const { client } = await connect({
      DEV_PROXY_BACKEND_TRANSPORT: 'http',
      DEV_PROXY_PORT: '39917',
      DEV_PROXY_FIXTURE_FAIL: '1',
    });
    expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(devTools);
    expect(Date.now() - startedAt).toBeLessThan(8000);
  });

  it('returns recovery tools after a failed start and refreshes discovery after restarts', async () => {
    const { client, notifications } = await connect({ DEV_PROXY_FIXTURE_FAIL: '1' });
    expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(devTools);

    for (const name of ['recovered_tool', 'restarted_tool']) {
      const restart = await client.callTool({
        name: 'dev_restart_debugger',
        arguments: { env: { DEV_PROXY_FIXTURE_FAIL: '0', DEV_PROXY_FIXTURE_TOOL: name } },
      });
      expect(restart.isError).not.toBe(true);
      expect((await client.listTools()).tools.map(tool => tool.name)).toEqual([name, ...devTools]);
    }
    expect(notifications).toHaveLength(2);
  });

  it('announces the shrunken inventory when a restart fails', async () => {
    // Start from a failed start, so the only notifications are the restarts' own.
    const { client, notifications } = await connect({ DEV_PROXY_FIXTURE_FAIL: '1' });
    expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(devTools);

    const recovered = await client.callTool({
      name: 'dev_restart_debugger',
      arguments: { env: { DEV_PROXY_FIXTURE_FAIL: '0', DEV_PROXY_FIXTURE_TOOL: 'recovered_tool' } },
    });
    expect(recovered.isError).not.toBe(true);
    expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(['recovered_tool', ...devTools]);

    const failed = await client.callTool({
      name: 'dev_restart_debugger',
      arguments: { env: { DEV_PROXY_FIXTURE_FAIL: '1' } },
    });
    expect(failed.isError).toBe(true);

    // A rebuild whose new dist throws at startup changes the inventory too; without
    // the notification the client keeps offering a backend tool that is now gone.
    await expect.poll(() => notifications).toHaveLength(2);
    expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(devTools);
  });

  it('holds a tool call for an in-flight restart instead of refusing it', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mcp-proxy-restart-'));
    directories.push(dir);
    const releaseFile = path.join(dir, 'ready');
    const { client } = await connect();
    expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(['fixture_tool', ...devTools]);

    // Restart into a backend that cannot finish starting until it is released.
    const restart = observe(client.callTool({
      name: 'dev_restart_debugger',
      arguments: { env: { DEV_PROXY_FIXTURE_RELEASE: releaseFile, DEV_PROXY_FIXTURE_TOOL: 'restarted_tool' } },
    }));
    await expect.poll(async () => {
      const status = await client.callTool({ name: 'dev_server_status', arguments: {} });
      return (status.content as Array<{ text: string }>)[0]?.text;
    }, { timeout: 10000 }).toContain('"state": "starting"');

    let answered = false;
    const pending = observe(client.callTool({ name: 'restarted_tool', arguments: {} }))
      .then(outcome => { answered = true; return outcome; });
    // Long enough that a proxy which refuses mid-restart calls would already
    // have answered — the wait, not a lucky race, is what this asserts.
    await setTimeout(200);
    expect(answered, 'the call was answered before the backend finished restarting').toBe(false);

    await writeFile(releaseFile, 'ready');
    const forwarded = await pending;
    expect(forwarded.error).toBeUndefined();
    expect(forwarded.result?.isError, JSON.stringify(forwarded.result)).not.toBe(true);
    expect((await restart).result?.isError).not.toBe(true);
  });
});

describe('dev-proxy rebuild failure reporting (issue #718)', () => {
  it('reports a failed build by message only, keeps the running backend, and attaches no cause chain', async () => {
    const { client } = await connect({
      DEV_PROXY_BUILD_CMD: `"${process.execPath}" -e "console.error('boom: build exploded'); process.exit(1)"`,
    });
    expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(['fixture_tool', ...devTools]);

    const failed = await client.callTool({ name: 'dev_rebuild_and_restart', arguments: {} });
    expect(failed.isError).toBe(true);
    const payload = JSON.parse((failed.content as Array<{ text: string }>)[0]?.text ?? '{}');
    // The build's own output reaches the caller only through the sanitized
    // message (issue #154); the caught execSync error rides on `cause` for
    // programmatic consumers and must not be serialized into the response.
    expect(Object.keys(payload).sort()).toEqual(['error', 'success']);
    expect(payload.success).toBe(false);
    expect(payload.error).toMatch(/^Build failed: /);
    expect(payload.error).toContain('boom: build exploded');

    // The rebuild failed before the restart, so the old backend still serves.
    expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(['fixture_tool', ...devTools]);
    const forwarded = await client.callTool({ name: 'fixture_tool', arguments: {} });
    expect(forwarded.isError, JSON.stringify(forwarded)).not.toBe(true);
  });
});

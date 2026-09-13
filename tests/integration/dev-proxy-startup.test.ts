import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
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

    const firstTools = client.listTools();
    const status = await client.callTool({ name: 'dev_server_status', arguments: {} });
    expect(status.content).toEqual([expect.objectContaining({ text: expect.stringContaining('"starting"') })]);
    await writeFile(releaseFile, 'ready');

    expect((await firstTools).tools.map(tool => tool.name)).toEqual(['fixture_tool', ...devTools]);
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
});

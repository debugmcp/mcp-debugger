import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const devTools = ['dev_restart_debugger', 'dev_rebuild_and_restart', 'dev_server_status'];
interface Status {
  state: string;
  pid: number | null;
  buildInProgress: boolean;
  backendEnvOverrides: Record<string, string>;
}
interface RestartResult { success: boolean; error?: string; status: Status }
interface Event { kind: string; pid: number; index?: number; tool?: string }
type ToolResult = Awaited<ReturnType<Client['callTool']>>;

function payload<T>(result: ToolResult): T {
  const text = (result.content as Array<{ type: string; text?: string }>).find(item => item.type === 'text')?.text;
  if (!text) throw new Error('Expected a text tool response');
  return JSON.parse(text) as T;
}

function observe<T>(promise: Promise<T>) {
  return promise.then(result => ({ result, error: undefined }), (error: unknown) => ({ result: undefined, error }));
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    // Containers may not reap adopted children promptly. A zombie has stopped
    // executing and closed its handles; it is not a surviving build process.
    if (process.platform === 'linux') {
      return !/^State:\s+Z/m.test(readFileSync(`/proc/${pid}/status`, 'utf8'));
    }
    return true;
  } catch {
    return false;
  }
}

const clients: Client[] = [];
const directories: string[] = [];
const ownedPids = new Set<number>();
async function readEvents(directory: string): Promise<Event[]> {
  const text = await readFile(path.join(directory, 'events.ndjson'), 'utf8').catch((err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') return '';
    throw err;
  });
  return text.trim() ? text.trim().split('\n').map(line => JSON.parse(line) as Event) : [];
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map(client => client.close()));
  for (const pid of ownedPids) {
    if (isAlive(pid)) {
      try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
    }
  }
  ownedPids.clear();
  for (const directory of directories.splice(0)) {
    // Own every fixture PID explicitly, including when a regression prevents
    // the proxy from cleaning up. Never use a process-name-wide test reaper.
    for (const event of await readEvents(directory)) {
      if (isAlive(event.pid)) {
        try { process.kill(event.pid, 'SIGKILL'); } catch { /* already gone */ }
      }
    }
    await rm(directory, { recursive: true, force: true });
  }
});

async function connect(extraEnv: Record<string, string> = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mcp-rebuild-'));
  directories.push(directory);
  const client = new Client({ name: 'rebuild-test', version: '1.0.0' });
  clients.push(client);
  const notifications: string[] = [];
  client.setNotificationHandler(ToolListChangedNotificationSchema, async n => { notifications.push(n.method); });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(root, 'tools/dev-proxy/dev-proxy.mjs')],
    cwd: root,
    env: {
      ...process.env,
      DEV_PROXY_ROOT: root,
      DEV_PROXY_BACKEND_TRANSPORT: 'stdio',
      DEV_PROXY_BACKEND_CMD: `"${process.execPath}" "${path.join(root, 'tests/fixtures/dev-proxy/startup-backend.mjs')}"`,
      DEV_PROXY_BUILD_CMD: `"${process.execPath}" "${path.join(root, 'tests/fixtures/dev-proxy/controlled-build.mjs')}"`,
      DEV_PROXY_BUILD_TIMEOUT_MS: '20000',
      DEV_PROXY_BUILD_FIXTURE_DIR: directory,
      DEV_PROXY_FIXTURE_EVENTS: path.join(directory, 'events.ndjson'),
      DEV_PROXY_FIXTURE_FAIL: '0', DEV_PROXY_FIXTURE_RELEASE: '', DEV_PROXY_FIXTURE_TOOL: 'initial',
      DEV_PROXY_BUILD_CHILD: '0', DEV_PROXY_BUILD_IGNORE_TERM: '0',
      ...extraEnv,
    },
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', chunk => { stderr += chunk.toString(); });
  await client.connect(transport);
  await client.listTools();
  await expect.poll(() => notifications.length).toBe(1);
  const call = (name: string, args: Record<string, unknown> = {}) => client.callTool(
    { name, arguments: args }, undefined, { timeout: 10000 }
  );
  return {
    client, transport, directory, notifications, call, stderr: () => stderr,
    status: async () => {
      const status = payload<Status>(await call('dev_server_status'));
      if (status.pid) ownedPids.add(status.pid);
      return status;
    },
    events: () => readEvents(directory),
    release: async (index: number, code = 0) => {
      const file = path.join(directory, `release-${index}`);
      // Publish the exit code atomically: existsSync can otherwise see the
      // empty file between open and write, interpreting a requested 1 as 0.
      await writeFile(`${file}.tmp`, String(code));
      await rename(`${file}.tmp`, file);
    },
    waitFor: (kind: string, count: number) => expect.poll(async () => (
      (await readEvents(directory)).filter(e => e.kind === kind).length
    ), { timeout: 10000 }).toBe(count),
  };
}

describe('dev-proxy responsive rebuilds (#748, #756, #757)', () => {
  it.each(['http', 'sse'])('serves an actual %s backend during a build and shuts it down intentionally', async mode => {
    const listener = net.createServer();
    const port = await new Promise<number>((resolve, reject) => {
      listener.once('error', reject);
      listener.listen(0, '127.0.0.1', () => {
        const address = listener.address();
        if (!address || typeof address === 'string') { listener.close(); reject(new Error('No port')); return; }
        listener.close(error => error ? reject(error) : resolve(address.port));
      });
    });
    const h = await connect({
      DEV_PROXY_BACKEND_TRANSPORT: mode,
      DEV_PROXY_BACKEND_CMD: `"${process.execPath}" "${path.join(root, 'dist/index.js')}" ${mode} --port ${port}`,
      DEV_PROXY_PORT: String(port),
      MCP_SKIP_ORPHAN_REAPERS: '1',
    });
    const before = await h.status();
    const proxyPid = h.transport.pid!;
    const rebuild = observe(h.call('dev_rebuild_and_restart'));
    await h.waitFor('build-start', 1);
    expect(await h.status()).toMatchObject({ state: 'running', pid: before.pid, buildInProgress: true });
    expect((await h.call('list_debug_sessions')).isError).not.toBe(true);
    await h.client.close();
    await rebuild;
    await expect.poll(() => [proxyPid, before.pid!].filter(isAlive), { timeout: 5000 }).toEqual([]);
    expect(h.stderr()).not.toContain('Backend crashed');
    expect(h.stderr()).not.toContain('Killing orphaned child process');
  });

  it('serves status, tools, discovery and resources, and drains stderr before releasing the build', async () => {
    const h = await connect();
    const before = await h.status();
    const rebuild = observe(h.call('dev_rebuild_and_restart', { env: { DEV_PROXY_FIXTURE_TOOL: 'updated' } }));
    await h.waitFor('build-start', 1);

    const [status, tools, result, resources, resource] = await Promise.all([
      h.status(),
      h.client.listTools({}, { timeout: 5000 }),
      h.call('initial', { floodStderr: true }),
      h.client.listResources({}, { timeout: 5000 }),
      h.client.readResource({ uri: 'fixture://status' }, { timeout: 5000 }),
    ]);
    expect(status).toMatchObject({ state: 'running', pid: before.pid, buildInProgress: true, backendEnvOverrides: {} });
    expect(tools.tools.map(tool => tool.name)).toEqual(['initial', ...devTools]);
    expect(result.isError).not.toBe(true);
    expect(resources.resources[0].uri).toBe('fixture://status');
    expect(resource.contents[0]).toMatchObject({ text: 'initial' });
    expect((await h.events()).some(e => e.kind === 'build-end')).toBe(false);

    await h.release(1);
    const completed = await rebuild;
    expect(completed.error).toBeUndefined();
    const response = payload<RestartResult>(completed.result!);
    expect(response).toMatchObject({ success: true, status: { state: 'running', buildInProgress: false } });
    expect(response.status.pid).not.toBe(before.pid);
    expect(h.notifications).toHaveLength(2);
  });

  it('serializes both rebuild tools and plain restarts, preserving each request and response', async () => {
    const h = await connect();
    const a = observe(h.call('dev_restart_debugger', { rebuild: true, env: { DEV_PROXY_FIXTURE_TOOL: 'A' } }));
    await h.waitFor('build-start', 1);
    const b = observe(h.call('dev_rebuild_and_restart', { env: { DEV_PROXY_FIXTURE_TOOL: 'B' } }));
    const inherited = observe(h.call('dev_restart_debugger'));
    const cleared = observe(h.call('dev_restart_debugger', { env: {} }));
    // This later request proves the preceding calls have reached the proxy.
    expect((await h.status()).buildInProgress).toBe(true);
    expect((await h.events()).filter(e => e.kind === 'build-start')).toHaveLength(1);
    await h.release(1);
    const first = payload<RestartResult>((await a).result!);
    await h.waitFor('build-start', 2);
    expect(await h.status()).toMatchObject({ pid: first.status.pid, backendEnvOverrides: { DEV_PROXY_FIXTURE_TOOL: 'A' } });
    await h.release(2);

    const responses = [first, ...await Promise.all([b, inherited, cleared].map(async outcome => {
      const value = await outcome;
      expect(value.error).toBeUndefined();
      return payload<RestartResult>(value.result!);
    }))];
    expect(responses.map(r => r.status.backendEnvOverrides)).toEqual([
      { DEV_PROXY_FIXTURE_TOOL: 'A' }, { DEV_PROXY_FIXTURE_TOOL: 'B' }, { DEV_PROXY_FIXTURE_TOOL: 'B' }, {},
    ]);
    for (const response of responses) {
      expect(response).toMatchObject({ success: true, status: { state: 'running', buildInProgress: false } });
      expect(response.status.pid).toBeTypeOf('number');
    }
    const events = await h.events();
    expect(events.filter(e => e.kind === 'backend-start').map(e => e.tool)).toEqual(['initial', 'A', 'B', 'B', 'initial']);
    expect(events.filter(e => e.kind.startsWith('build-')).map(e => [e.kind, e.index])).toEqual([
      ['build-start', 1], ['build-end', 1], ['build-start', 2], ['build-end', 2],
    ]);
    // Backend-only settings never leak into the build environment.
    expect(events.filter(e => e.kind === 'build-start').map(e => e.tool)).toEqual(['initial', 'initial']);
    expect(h.notifications).toHaveLength(5);
  });

  it('keeps the running backend and settings after build failure, then recovers', async () => {
    const h = await connect();
    const before = await h.status();
    const failed = observe(h.call('dev_rebuild_and_restart', { env: { DEV_PROXY_FIXTURE_TOOL: 'discarded' } }));
    await h.waitFor('build-start', 1);
    await h.release(1, 1);
    const failure = await failed;
    expect(failure.error).toBeUndefined();
    expect(failure.result?.isError, JSON.stringify(failure.result)).toBe(true);
    expect(await h.status()).toMatchObject({ pid: before.pid, state: 'running', backendEnvOverrides: {}, buildInProgress: false });
    expect(h.notifications).toHaveLength(1);

    const invalid = await h.call('dev_restart_debugger', { env: null });
    expect(payload<RestartResult>(invalid).error).toContain('env must be an object');
    expect((await h.status()).pid).toBe(before.pid);
    const recovered = observe(h.call('dev_rebuild_and_restart'));
    await h.waitFor('build-start', 2);
    await h.release(2);
    expect(payload<RestartResult>((await recovered).result!)).toMatchObject({ success: true, status: { backendEnvOverrides: {} } });
    expect(h.notifications).toHaveLength(2);
  });

  it('releases an existing discovery waiter when a queued build begins', async () => {
    const h = await connect();
    const release = path.join(h.directory, 'backend-release');
    const restart = observe(h.call('dev_restart_debugger', {
      env: { DEV_PROXY_FIXTURE_RELEASE: release, DEV_PROXY_FIXTURE_TOOL: 'changed' },
    }));
    await h.waitFor('backend-start', 2);
    const rebuild = observe(h.call('dev_rebuild_and_restart'));
    const discovery = observe(h.client.listTools({}, { timeout: 5000 }));
    expect((await h.status()).state).toBe('starting');
    await writeFile(release, 'ready');
    expect((await restart).result?.isError).not.toBe(true);
    await h.waitFor('build-start', 1);
    const listed = await discovery;
    expect(listed.error).toBeUndefined();
    expect(listed.result?.tools.map(t => t.name)).toEqual(['changed', ...devTools]);
    expect((await h.status()).buildInProgress).toBe(true);
    await h.release(1);
    expect((await rebuild).result?.isError).not.toBe(true);
  });

  it('notifies when a successful build is followed by a failed backend start', async () => {
    const h = await connect();
    const failed = observe(h.call('dev_rebuild_and_restart', { env: { DEV_PROXY_FIXTURE_FAIL: '1' } }));
    await h.waitFor('build-start', 1);
    await h.release(1);
    expect((await failed).result?.isError).toBe(true);
    expect((await h.status()).state).toBe('stopped');
    expect((await h.client.listTools()).tools.map(t => t.name)).toEqual(devTools);
    expect(h.notifications).toHaveLength(2);
  });

  it('kills timeout descendants even if they ignore SIGTERM and leaves the backend serving', async () => {
    const h = await connect({ DEV_PROXY_BUILD_CHILD: '1', DEV_PROXY_BUILD_IGNORE_TERM: '1', DEV_PROXY_BUILD_TIMEOUT_MS: '2000' });
    const before = await h.status();
    const failed = observe(h.call('dev_rebuild_and_restart'));
    await h.waitFor('build-child', 1);
    const pids = (await h.events()).filter(e => e.kind.startsWith('build-')).map(e => e.pid);
    expect(payload<RestartResult>((await failed).result!).error).toMatch(/^Build timed out after 2s/);
    await expect.poll(() => pids.some(isAlive), { timeout: 5000 }).toBe(false);
    expect(await h.status()).toMatchObject({ state: 'running', pid: before.pid, buildInProgress: false });
    expect((await h.call('initial')).isError).not.toBe(true);
    expect(h.notifications).toHaveLength(1);
  });

  it.each(['queued', 'building', 'starting'] as const)('shuts down with work %s without spawning queued replacements', async phase => {
    const h = await connect({ DEV_PROXY_BUILD_CHILD: '1', DEV_PROXY_BUILD_IGNORE_TERM: '1' });
    const proxyPid = h.transport.pid!;
    const env = { DEV_PROXY_FIXTURE_RELEASE: path.join(h.directory, 'backend-release') };
    const current = observe(h.call(phase === 'queued' ? 'dev_restart_debugger' : 'dev_rebuild_and_restart',
      phase === 'building' ? {} : { env }));
    if (phase !== 'queued') {
      await h.waitFor('build-child', 1);
      if (phase === 'starting') await h.release(1);
    }
    if (phase !== 'building') {
      await h.waitFor('backend-start', 2);
      expect((await h.status()).state).toBe('starting');
    }
    const queuedBuild = observe(h.call('dev_rebuild_and_restart'));
    const queuedRestart = observe(h.call('dev_restart_debugger'));
    await h.status();
    const before = await h.events();
    await h.client.close();
    await Promise.all([current, queuedBuild, queuedRestart]);
    await expect.poll(async () => [proxyPid, ...(await h.events()).map(e => e.pid)].filter(isAlive), { timeout: 5000 }).toEqual([]);
    const after = await h.events();
    expect(after.filter(e => e.kind === 'build-start')).toEqual(before.filter(e => e.kind === 'build-start'));
    expect(after.filter(e => e.kind === 'backend-start')).toEqual(before.filter(e => e.kind === 'backend-start'));
  }, 30000);
});

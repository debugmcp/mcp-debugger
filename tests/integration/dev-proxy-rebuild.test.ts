import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import type { Stream } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { OwnedStdioTransport } from '../test-utils/helpers/owned-stdio-transport.js';
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
interface Event { kind: string; pid: number; ppid?: number; at?: number; index?: number; tool?: string }
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
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ESRCH' || code === 'ENOENT') return false;
    throw error; // A denied/failed liveness probe is not proof of death.
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
  // A concurrent append can expose a partial last record; only newline-terminated
  // records have been published by the fixture.
  return text.split('\n').slice(0, -1).filter(Boolean).map(line => JSON.parse(line) as Event);
}

afterEach(async () => {
  const failures: unknown[] = [];
  // Cleanup must continue even when a client close or an event read fails.
  const outcomes = await Promise.allSettled(clients.splice(0).map(client => client.close()));
  failures.push(...outcomes.filter(outcome => outcome.status === 'rejected').map(outcome => outcome.reason));
  const cleanupDirectories = directories.splice(0);
  for (const directory of cleanupDirectories) {
    try {
      for (const event of await readEvents(directory)) {
        ownedPids.add(event.pid);
        // build-start is the Node child of the owned command shell. This also
        // cleans the shell, which never writes its own fixture event.
        if (event.kind === 'build-start' && event.ppid) ownedPids.add(event.ppid);
      }
    } catch (error) { failures.push(error); }
  }
  const pids = [...ownedPids];
  ownedPids.clear();
  for (const pid of pids) {
    try {
      if (isAlive(pid)) process.kill(pid, 'SIGKILL');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') failures.push(error);
    }
  }
  try {
    await expect.poll(() => pids.filter(isAlive), { timeout: 5000 }).toEqual([]);
  } catch (error) { failures.push(error); }
  for (const directory of cleanupDirectories) {
    try { await rm(directory, { recursive: true, force: true }); }
    catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, 'dev-proxy fixture cleanup failed');
}, 20000);

async function unusedPort(): Promise<number> {
  const listener = net.createServer();
  return new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', () => {
      const address = listener.address();
      if (!address || typeof address === 'string') { listener.close(); reject(new Error('No port')); return; }
      listener.close(error => error ? reject(error) : resolve(address.port));
    });
  });
}

async function processIdentities(pids: number[]): Promise<string> {
  if (!pids.length) return 'none';
  const runFile = promisify(execFile);
  try {
    const command = process.platform === 'win32' ? 'powershell.exe' : 'ps';
    const args = process.platform === 'win32'
      ? ['-NoProfile', '-NonInteractive', '-Command',
        `Get-CimInstance Win32_Process -Filter "${pids.map(pid => `ProcessId = ${pid}`).join(' OR ')}" | Select-Object ProcessId,ParentProcessId,CreationDate,Name,CommandLine | ConvertTo-Json -Compress`]
      : ['-p', pids.join(','), '-o', 'pid=,ppid=,stat=,args='];
    const result = await runFile(command, args, { windowsHide: true, timeout: 2000 });
    return result.stdout.trim() || 'none';
  } catch (error) { return `identity probe failed: ${String(error)}`; }
}

interface ConnectOptions { sdkTransport?: boolean; delayTreeKill?: boolean; gatePortProbe?: boolean }
async function connect(extraEnv: Record<string, string> = {}, options: ConnectOptions = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mcp-rebuild-'));
  directories.push(directory);
  const client = new Client({ name: 'rebuild-test', version: '1.0.0' });
  clients.push(client);
  const notifications: string[] = [];
  client.setNotificationHandler(ToolListChangedNotificationSchema, async n => { notifications.push(n.method); });
  const parameters = {
    command: process.execPath,
    args: [
      ...(options.delayTreeKill ? ['--import', new URL('../fixtures/dev-proxy/delay-build-taskkill.mjs', import.meta.url).href] : []),
      ...(options.gatePortProbe ? ['--import', new URL('../fixtures/dev-proxy/gate-port-probe.mjs', import.meta.url).href] : []),
      path.join(root, 'tools/dev-proxy/dev-proxy.mjs'),
    ],
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
  };
  const transport = options.sdkTransport
    ? new StdioClientTransport({ ...parameters, stderr: 'pipe' })
    : new OwnedStdioTransport(parameters.command, parameters.args, { cwd: parameters.cwd, env: parameters.env, windowsHide: true });
  if (transport.pid) ownedPids.add(transport.pid);
  let stderr = '';
  const stderrStream: Stream | null = transport.stderr;
  stderrStream?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
  try { await client.connect(transport); }
  finally { if (transport.pid) ownedPids.add(transport.pid); }
  await client.listTools();
  await expect.poll(() => notifications.length).toBe(1);
  const call = (name: string, args: Record<string, unknown> = {}) => client.callTool(
    { name, arguments: args }, undefined, { timeout: 10000 }
  );
  const diagnostics = async (pids: number[]) => {
    const events = await readEvents(directory);
    const survivors = [...new Set(pids)].filter(isAlive);
    return `at=${new Date().toISOString()} proxy=${transport.pid} survivors=${JSON.stringify(survivors)}\n` +
      `events=${JSON.stringify(events)}\nidentities=${await processIdentities(survivors)}\nstderr:\n${stderr}`;
  };
  return {
    client, transport, directory, notifications, call, stderr: () => stderr,
    shutdown: async () => {
      if (!(transport instanceof OwnedStdioTransport)) throw new Error('EOF shutdown requires a test-owned child');
      try {
        await transport.close();
        expect(transport.fallbackKills).toBe(0);
        expect(stderr).toContain('Shutdown complete');
      } catch (error) {
        throw new Error(`${String(error)}\n${await diagnostics([transport.pid!, ...(await readEvents(directory)).map(event => event.pid)])}`, { cause: error });
      } finally {
        // Keep the original failure's diagnostics if the same transport close
        // rejection is surfaced again by Client.close(). afterEach still reaps.
        await client.close().catch(() => {});
      }
    },
    diagnoseFailure: async (error: unknown, pids: number[]) => new Error(
      `${String(error)}\n${await diagnostics(pids)}`, { cause: error }
    ),
    assertDead: async (pids: number[], context = '') => {
      try { await expect.poll(() => [...new Set(pids)].filter(isAlive), { timeout: 5000 }).toEqual([]); }
      catch (error) { throw new Error(`${String(error)}\n${context}\n${await diagnostics(pids)}`, { cause: error }); }
    },
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
    const port = await unusedPort();
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
    await h.shutdown();
    await rebuild;
    await h.assertDead([proxyPid, before.pid!]);
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

  it('does not tell a caller to restart a crashed backend that a queued rebuild will replace', async () => {
    const h = await connect({ DEV_PROXY_DISCOVERY_WAIT_MS: '200' });
    const before = await h.status();
    process.kill(before.pid!, 'SIGKILL');
    await expect.poll(async () => (await h.status()).state, { timeout: 5000 }).toBe('stopped');
    const rebuild = observe(h.call('dev_rebuild_and_restart'));
    await h.waitFor('build-start', 1);

    // Requests are served during a build now, so this one sees "stopped" while
    // the rebuild is about to replace it. A restart hint here would queue a
    // second restart that kills the fresh backend (#716).
    const refused = await h.call('initial');
    expect(refused.isError).toBe(true);
    const body = payload<{ error: string; hint: string }>(refused);
    expect(body.error).toContain('stopped with a build in progress');
    expect(body.error).not.toContain('dev_restart_debugger');
    expect(body.hint).toContain('do NOT restart');

    await h.release(1);
    const completed = payload<RestartResult>((await rebuild).result!);
    expect(completed).toMatchObject({ success: true, status: { state: 'running' } });
    expect((await h.call('initial')).isError).not.toBe(true);
  });

  it('kills timeout descendants even if they ignore SIGTERM and leaves the backend serving', async () => {
    const h = await connect({ DEV_PROXY_BUILD_CHILD: '1', DEV_PROXY_BUILD_IGNORE_TERM: '1', DEV_PROXY_BUILD_TIMEOUT_MS: '2000' });
    const before = await h.status();
    const failed = observe(h.call('dev_rebuild_and_restart'));
    await h.waitFor('build-child', 1);
    const pids = (await h.events()).filter(e => e.kind.startsWith('build-')).map(e => e.pid);
    const outcome = await failed;
    try {
      expect(outcome.error).toBeUndefined();
      expect(outcome.result?.isError).toBe(true);
      const failure = payload<RestartResult>(outcome.result!);
      expect(failure.error).toMatch(/^Build timed out after 2s/);
      expect(failure.error).not.toContain('Build process cleanup failed');
      await h.assertDead(pids, JSON.stringify(failure));
    } catch (error) {
      throw await h.diagnoseFailure(new Error(`${String(error)}\nresponse=${JSON.stringify(outcome.result)}`, { cause: error }), pids);
    }
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
    await h.shutdown();
    await Promise.all([current, queuedBuild, queuedRestart]);
    await h.assertDead([proxyPid, ...(await h.events()).map(e => e.pid)]);
    const after = await h.events();
    expect(after.filter(e => e.kind === 'build-start')).toEqual(before.filter(e => e.kind === 'build-start'));
    expect(after.filter(e => e.kind === 'backend-start')).toEqual(before.filter(e => e.kind === 'backend-start'));
  }, 30000);
  it('answers status while the actual HTTP restart is waiting on its OS listener probe (#799)', async () => {
    const port = await unusedPort();
    const h = await connect({
      DEV_PROXY_BACKEND_TRANSPORT: 'http',
      DEV_PROXY_BACKEND_CMD: `"${process.execPath}" "${path.join(root, 'dist/index.js')}" http --port ${port}`,
      DEV_PROXY_PORT: String(port),
      MCP_SKIP_ORPHAN_REAPERS: '1',
    }, { gatePortProbe: true });
    const before = await h.status();
    let completed = false;
    const restart = observe(h.call('dev_restart_debugger')).then(outcome => { completed = true; return outcome; });
    await h.waitFor('port-probe-blocked', 1);
    expect(completed).toBe(false);
    // The gate is released only after this real MCP request answers. No timing
    // threshold can turn a fast completion into a false responsiveness pass.
    expect(await h.status()).toMatchObject({ state: 'starting', buildInProgress: false });
    expect(completed).toBe(false);
    expect((await h.events()).some(event => ['port-probe-released', 'port-probe-expired'].includes(event.kind))).toBe(false);
    await writeFile(path.join(h.directory, 'release-port-probe'), 'ready');
    const outcome = await restart;
    expect(outcome.error).toBeUndefined();
    expect(payload<RestartResult>(outcome.result!)).toMatchObject({ success: true, status: { state: 'running' } });
    expect((await h.status()).pid).not.toBe(before.pid);
    expect((await h.events()).some(event => event.kind === 'port-probe-released')).toBe(true);
  });

  it('retains SDK-client close coverage for a normally responsive supervisor', async () => {
    const h = await connect({}, { sdkTransport: true });
    const proxyPid = h.transport.pid!;
    const before = await h.status();
    await h.client.close();
    await h.assertDead([proxyPid, before.pid!]);
    expect(h.stderr()).toContain('Shutdown complete');
  });

  it.skipIf(process.platform !== 'win32')('waits past the SDK close grace for a slow tree sweep and never starts queued work', async () => {
    const h = await connect({ DEV_PROXY_BUILD_CHILD: '1', DEV_PROXY_BUILD_IGNORE_TERM: '1' }, { delayTreeKill: true });
    const proxyPid = h.transport.pid!;
    const current = observe(h.call('dev_rebuild_and_restart'));
    await h.waitFor('build-child', 1);
    const queuedBuild = observe(h.call('dev_rebuild_and_restart'));
    const queuedRestart = observe(h.call('dev_restart_debugger'));
    await h.status(); // Both requests are queued before EOF.
    const before = await h.events();
    const shutdown = observe(h.shutdown());
    await h.waitFor('tree-kill-delayed', 1);
    // Keep the real process alive beyond the SDK's 2 s grace. Dispatch is gated
    // by a file, so scheduler differences cannot make it happen before release.
    await delay(2200);
    expect(isAlive(proxyPid)).toBe(true);
    expect((await h.events()).some(event => ['tree-kill-dispatched', 'tree-kill-expired'].includes(event.kind))).toBe(false);
    await writeFile(path.join(h.directory, 'release-tree-kill'), 'ready');
    expect((await shutdown).error).toBeUndefined();
    await Promise.all([current, queuedBuild, queuedRestart]);
    const after = await h.events();
    const delayed = after.find(event => event.kind === 'tree-kill-delayed')!;
    const dispatched = after.find(event => event.kind === 'tree-kill-dispatched')!;
    expect(dispatched.at! - delayed.at!).toBeGreaterThanOrEqual(2000);
    expect(after.filter(event => event.kind === 'build-start')).toEqual(before.filter(event => event.kind === 'build-start'));
    expect(after.filter(event => event.kind === 'backend-start')).toEqual(before.filter(event => event.kind === 'backend-start'));
    await h.assertDead([proxyPid, ...after.map(event => event.pid)]);
  });

  it.skipIf(process.platform !== 'win32')('reproduces SDK early escalation interrupting a slow build-tree sweep (#930)', async () => {
    const h = await connect({ DEV_PROXY_BUILD_CHILD: '1', DEV_PROXY_BUILD_IGNORE_TERM: '1' }, { sdkTransport: true, delayTreeKill: true });
    const proxyPid = h.transport.pid!;
    const current = observe(h.call('dev_rebuild_and_restart'));
    await h.waitFor('build-child', 1);
    const buildPids = (await h.events()).filter(event => event.kind.startsWith('build-')).map(event => event.pid);
    await h.client.close();
    await current;
    await h.assertDead([proxyPid]);
    const events = await h.events();
    expect(events.some(event => event.kind === 'tree-kill-delayed')).toBe(true);
    expect(events.some(event => ['tree-kill-dispatched', 'tree-kill-expired'].includes(event.kind))).toBe(false);
    expect(h.stderr()).not.toContain('Shutdown complete');
    // This is intentionally the harness failure mode, not successful cleanup.
    // afterEach owns these exact fixture PIDs and reaps them before removing logs.
    expect(buildPids.some(isAlive)).toBe(true);
  });

});

/** Linux sibling-process attach, including hosts with Yama ptrace_scope=1 (#759). */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { buildDockerImage, createDockerMcpClient, getDockerLogs } from './docker-test-utils.js';
import { parseSdkToolResult } from '../smoke-test-utils.js';

const execFileAsync = promisify(execFile);
const SOURCE = '/workspace/cobol/pause.cob';
const BINARY = '/app/logs/cobol-attach-pause';
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe.skipIf(process.env.SKIP_DOCKER_TESTS === 'true')('Docker: COBOL attach-by-PID', () => {
  let client: Client | undefined;
  let cleanup: (() => Promise<void>) | undefined;
  let container: string | undefined;
  let sessionId: string | undefined;
  let pid: number | undefined;

  beforeAll(async () => {
    await buildDockerImage({ imageName: 'mcp-debugger:test' });
  }, 300_000);

  async function exec(...args: string[]): Promise<string> {
    return (await execFileAsync('docker', ['exec', container!, ...args], { timeout: 60_000 })).stdout.trim();
  }

  async function call(name: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    return parseSdkToolResult(await client!.callTool({ name, arguments: { ...(sessionId ? { sessionId } : {}), ...args } }));
  }

  async function waitForState(state: string): Promise<void> {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const sessions = (await call('list_debug_sessions')).sessions as Array<{ id: string; state: string }>;
      if (sessions.find(session => session.id === sessionId)?.state === state) return;
      await delay(200);
    }
    throw new Error(`COBOL attach session did not reach ${state}`);
  }

  async function tick(): Promise<number> {
    const variables = (await call('get_local_variables')).variables as Array<{ name: string; value: string }>;
    const value = variables.find(variable => variable.name === 'WS-TICK')?.value;
    expect(value).toMatch(/^\d+$/);
    expect(variables.find(variable => variable.name === 'WS-ONE')?.value).toBe('1');
    return Number(value);
  }

  afterEach(async ctx => {
    if (container && ctx.task.result?.state === 'fail') console.log(await getDockerLogs(container));
    if (sessionId && client) await call('close_debug_session').catch(() => undefined);
    if (pid && container) await exec('kill', '-KILL', String(pid)).catch(() => undefined);
    await cleanup?.();
    client = undefined;
    cleanup = undefined;
    container = undefined;
    sessionId = undefined;
    pid = undefined;
  });

  it.each(['sources', 'manifestDirs'] as const)('attaches with %s, inspects, resumes and detaches without killing the job', async mode => {
    container = `mcp-debugger-cobol-attach-${mode}-${Date.now()}`;
    const connection = await createDockerMcpClient({
      imageName: 'mcp-debugger:test', containerName: container, logLevel: 'debug',
      // Root inside this disposable container retains the added capability even
      // when the host test helper normally selects an unprivileged numeric uid.
      extraRunArgs: ['--cap-add=SYS_PTRACE', '--user=0:0']
    });
    client = connection.client;
    cleanup = connection.cleanup;
    console.log(`[COBOL attach] ${await exec('cobc', '--version')}`);
    await exec('cobc', '-x', '-g', '-A', '-O0 -gdwarf-4', '-o', BINARY, SOURCE);
    const before = await exec('sha256sum', BINARY);

    const config: Record<string, unknown> = { program: BINARY };
    if (mode === 'sources') {
      config.sources = [SOURCE];
    } else {
      // This case makes its own manifest; it never depends on the sources case.
      const manifestDir = await exec('node', '--input-type=module', '-e', `
        import { GnuCobolBuilder } from '/app/node_modules/@debugmcp/adapter-cobol/dist/build/gnucobol-builder.js';
        import { findCobc } from '/app/node_modules/@debugmcp/adapter-cobol/dist/build/cobc-locator.js';
        const cobc = await findCobc();
        if (!cobc) throw new Error('GnuCOBOL missing in the required Docker lane');
        const result = await new GnuCobolBuilder({ cobc }).build({
          program: ${JSON.stringify(BINARY)}, sources: [${JSON.stringify(SOURCE)}], mode: 'manifest-only'
        });
        if (!result.success) throw new Error(result.error);
        console.log(result.artifactDir);
      `);
      config.manifestDirs = [manifestDir];
      // Prove attach with existing manifests works without the compiler.
      await exec('mv', '/usr/bin/cobc', '/app/logs/cobc-hidden');
    }

    pid = Number(await exec('node', '-e', `
      const child = require('node:child_process').spawn(${JSON.stringify(BINARY)}, [], { detached: true, stdio: 'ignore' });
      child.on('error', error => { throw error; });
      child.unref(); console.log(child.pid);
    `));
    expect(Number.isInteger(pid) && pid > 0).toBe(true);
    await delay(1200);

    sessionId = (await call('create_debug_session', { language: 'cobol', name: `docker-cobol-attach-${mode}` })).sessionId as string;
    const attached = await call('attach_to_process', { processId: pid, stopOnEntry: true, adapterConfig: config });
    expect(attached.success, JSON.stringify(attached)).toBe(true); // No environmental skip in this required lane.
    await waitForState('paused');
    expect(await exec('sha256sum', BINARY)).toBe(before);

    const frames = (await call('get_stack_trace')).stackFrames as Array<{ file?: string; name?: string }>;
    expect(frames.some(frame => frame.file?.endsWith('pause.cob') && frame.name?.includes('PAUSE'))).toBe(true);
    const raw = (await call('get_stack_trace', { includeInternals: true })).stackFrames as Array<{ id: number }>;
    const scopes = (await call('get_scopes', { frameId: raw[0].id })).scopes as Array<{ name: string }>;
    expect(scopes.map(scope => scope.name)).toContainEqual(expect.stringMatching(/^WORKING-STORAGE of PAUSE/));
    const first = await tick();
    expect(first).toBeGreaterThanOrEqual(1);
    expect(String((await call('evaluate_expression', { expression: 'WS-TICK' })).result)).toMatch(new RegExp(`^${first} \\(evaluated in PAUSE:`));

    expect((await call('continue_execution')).success).toBe(true);
    await waitForState('running');
    await delay(2200);
    expect((await call('pause_execution')).success).toBe(true);
    await waitForState('paused');
    expect(await tick()).toBeGreaterThan(first);

    expect((await call('detach_from_process')).success).toBe(true);
    sessionId = undefined;
    await delay(1200);
    await exec('kill', '-0', String(pid));
  }, 120_000);
});

/**
 * Real MCP -> Delve -> Go coverage for issue #753. Delve never sends a DAP
 * `exited` event; it prints "Process N has exited with status S" to the
 * console — under noDebug before `terminated`, in debug mode only in reply
 * to `disconnect` — and the proxy reads that line back so `exitCode` appears
 * like every other language's. Runs in CI (Go 1.21 + dlv 1.24.2 on ubuntu
 * and windows) — the first CI-run test that spawns real Delve; `dist/` must
 * be built (CI builds before the integration project).
 *
 * The fixture is its own Go module pinned to `go 1.21`: dlv 1.24.2 accepts
 * binaries built by Go 1.21–1.24 only, and the root examples/go module pins a
 * newer Go. A developer whose local Go is newer than their dlv's window fails
 * (not skips) this test — upgrade dlv.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { getGoSearchPaths } from '@debugmcp/adapter-go';
import { skipIfSpawnBlocked, type SkippableContext } from '../../../test-utils/helpers/adapter-spawn.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const fixtureDir = path.join(root, 'examples/go/exit_code');
const program = path.join(fixtureDir, 'main.go');
const scrubbed = new Set(['NODE_OPTIONS', 'DEBUG_MCP_SKIP_AUTO_START', 'MCP_DEBUGGER_EXITCODE_FILE',
  'MCP_DEBUGGER_EXITCODE_CLAIMED', 'DEBUG', 'DAP_TRACE_FILE']);

function hasCommand(cmd: string, args: string[]): boolean {
  try {
    return spawnSync(cmd, args, { windowsHide: true, stdio: 'ignore' }).status === 0;
  } catch {
    return false;
  }
}
/** The gate mirrors the Go adapter's own lookup (DLV_PATH, PATH, then getGoSearchPaths — e.g. ~/go/bin), so "skipped" means the product could not have run Delve either. */
function hasDelve(): boolean {
  if (hasCommand(process.env.DLV_PATH ?? 'dlv', ['version'])) return true;
  const exe = process.platform === 'win32' ? 'dlv.exe' : 'dlv';
  return getGoSearchPaths().some(dir => hasCommand(path.join(dir, exe), ['version']));
}
const hasGo = hasCommand('go', ['version']) && hasDelve();

interface Result { success: boolean; state?: string; message?: string; data?: { exitCode?: number } }
interface Listed { id: string; state: string; exitCode?: number }
let client: Client;
let sessionId: string | undefined;

async function call<T extends Result = Result>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const raw = await client.callTool({ name, arguments: { ...(sessionId ? { sessionId } : {}), ...args } }, undefined, { timeout: 60_000 });
  expect(raw.isError, JSON.stringify(raw)).not.toBe(true);
  const content = raw.content as Array<{ type: string; text?: string }>;
  return JSON.parse(content.find(item => item.type === 'text')!.text!) as T;
}

async function listedSession(): Promise<Listed | undefined> {
  const listed = await call<Result & { sessions: Listed[] }>('list_debug_sessions');
  return listed.sessions.find(session => session.id === sessionId);
}

async function outputText(): Promise<string> {
  const output = await call<Result & { entries: Array<{ output: string }> }>('get_output', { limit: 1000 });
  return output.entries.map(entry => entry.output).join('');
}

describe.skipIf(!hasGo)('Go exit code from Delve\'s console status line (issue #753)', () => {
  beforeEach(async () => {
    client = new Client({ name: 'go-exit-code-integration', version: '1' });
    const env = Object.fromEntries(Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined && !scrubbed.has(entry[0].toUpperCase())
    ));
    const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(root, 'dist/index.js'), 'stdio'],
      cwd: root, env: { ...env, MCP_SKIP_ORPHAN_REAPERS: '1', MCP_EXIT_ON_STDIN_CLOSE: '1' }, stderr: 'pipe' });
    transport.stderr?.on('data', () => {});
    await client.connect(transport);
    const created = await call<Result & { sessionId: string }>('create_debug_session', { language: 'go', name: 'exit-code' });
    expect(created.success).toBe(true);
    sessionId = created.sessionId;
  });

  afterEach(async () => {
    try {
      if (sessionId) await client.callTool({ name: 'close_debug_session', arguments: { sessionId } }, undefined, { timeout: 5000 }).catch(() => {});
    } finally {
      sessionId = undefined;
      await client?.close();
    }
  }, 15_000);

  /** Launch, then require the exit code on the run-to-completion summary (when the launch saw it) and on list_debug_sessions. */
  async function launchAndExpectExit(args: Record<string, unknown>, expected: number, ctx: SkippableContext): Promise<void> {
    const result = await call('start_debugging', args);
    if (!result.success) skipIfSpawnBlocked(ctx, result, 'Go');
    expect(result.success, JSON.stringify(result)).toBe(true);
    if (result.state === 'stopped') {
      expect(result.data?.exitCode, JSON.stringify(result)).toBe(expected);
      expect(result.message).toContain(expected === 0 ? 'ran to completion (exit code 0)' : `exited with code ${expected}`);
    }
    await expect.poll(async () => (await listedSession())?.exitCode, { timeout: 30_000 }).toBe(expected);
  }

  it('reports a non-zero exit code in debug mode, where Delve prints the status only in reply to disconnect', async (ctx) => {
    await launchAndExpectExit({ scriptPath: program, args: ['7'], dapLaunchArgs: { stopOnEntry: false, cwd: fixtureDir } }, 7, ctx);
    const text = await outputText();
    expect(text).toContain('exit_code fixture: exiting with status 7');
    expect(text).toMatch(/has exited with status 7/);
  }, 90_000);

  it('reports exit code 0 for a clean run in debug mode', async (ctx) => {
    await launchAndExpectExit({ scriptPath: program, dapLaunchArgs: { stopOnEntry: false, cwd: fixtureDir } }, 0, ctx);
  }, 90_000);

  it('reports the exit code under noDebug, where Delve prints the status before terminated', async (ctx) => {
    // Delve runs a noDebug target through Go's exec, so on Windows the binary needs its .exe.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-go-exit-'));
    try {
      const binary = path.join(tmp, process.platform === 'win32' ? 'exit_code.exe' : 'exit_code');
      const build = spawnSync('go', ['build', '-gcflags=all=-N -l', '-o', binary, '.'], { windowsHide: true, cwd: fixtureDir, encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
      expect(build.status, `go build failed: ${build.stderr}`).toBe(0);
      await launchAndExpectExit({ scriptPath: binary, args: ['7'], dapLaunchArgs: { noDebug: true } }, 7, ctx);
    } finally {
      // On Windows the exited debuggee's image can stay locked for a moment after the session
      // ends, so the first rmdir may hit EBUSY; rmSync retries EBUSY/EPERM with these options.
      fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
  }, 90_000);
});

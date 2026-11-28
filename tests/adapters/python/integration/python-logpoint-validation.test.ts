/**
 * Real debugpy coverage for issue #1334: on a launched Python session, set_breakpoint
 * refuses a logpoint whose brace group holds an f-string conversion, format spec or
 * `=` form, or a dict without its own braces, naming every bad group and the form that
 * works; leaves no breakpoint behind; and each named replacement, set as a logpoint,
 * logs what the caller meant. A group that parses only joined to the next one is
 * accepted and evaluates.
 */
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  startStdioClient,
  type StdioClientHandle,
  type ToolAnswer
} from '../../../test-utils/helpers/mcp-stdio-client.js';
import { ensurePythonOnPath } from './env-utils.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(here, '../../../fixtures/python/logpoint_values.py');
const PREAMBLE = 'debugpy evaluates the text between braces as a Python expression,';

/** The fixture line marked `# case: <name>`. */
function caseLine(name: string): number {
  const index = fs.readFileSync(FIXTURE, 'utf8').split(/\r?\n/).findIndex((line) => line.endsWith(`# case: ${name}`));
  if (index < 0) throw new Error(`no "# case: ${name}" line in ${FIXTURE}`);
  return index + 1;
}

function hasDebugpy(): boolean {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v;
  }
  ensurePythonOnPath(env);
  for (const python of [process.env.PYTHON_PATH, 'python', 'python3'].filter((p): p is string => Boolean(p))) {
    try {
      const probe = spawnSync(python, ['-c', 'import debugpy'], {
        env,
        timeout: 15_000,
        windowsHide: true,
        stdio: 'ignore'
      });
      if (probe.status === 0) return true;
    } catch {
      // try next candidate
    }
  }
  return false;
}

type BreakpointAnswer = ToolAnswer & { breakpointId?: string; verified?: boolean };
type EndAnswer = ToolAnswer & { exitCode?: number };
type OutputAnswer = ToolAnswer & { entries?: Array<{ seq: number; category: string; output: string }> };

const REFUSALS: ReadonlyArray<readonly [logMessage: string, refusal: string]> = [
  ['{x!r}', `{x!r}: ${PREAMBLE} and !r is f-string syntax, not an expression; use {repr(x)} instead.`],
  ['stale={entry=!r}', `{entry=!r}: ${PREAMBLE} and =!r is f-string syntax, not an expression; use entry={repr(entry)} instead.`],
  ['{"k": total}', `{"k": total}: ${PREAMBLE} so a dict needs its own braces; use { {"k": total} } instead.`],
  [
    '{x!r} {total:.2f}',
    `{x!r}: ${PREAMBLE} and !r is f-string syntax, not an expression; use {repr(x)} instead. ` +
      `{total:.2f}: ${PREAMBLE} and :.2f is f-string syntax, not an expression; use {format(total, '.2f')} instead.`
  ]
];

/** The replacements the refusals name (and two accepted forms), with what debugpy logs. */
const LOGPOINTS: ReadonlyArray<readonly [caseName: string, logMessage: string, logged: string | RegExp]> = [
  ['repr', '{repr(x)}', "'café'"],
  ['format', "{format(total, '.2f')}", '3.50'],
  ['debug-conversion', 'stale=entry={repr(entry)}', "stale=entry='old'"],
  ['debug-spec', "total={format(total, '.2f')}", 'total=3.50'],
  ['debug', 'x={repr(x)}', "x='café'"],
  ['debug-call', 'len(items)={repr(len(items))}', 'len(items)=4'],
  ['dict', '{ {"k": total} }', "{'k': 3.5}"],
  ['slice', '{items[1:3]}', '[20, 30]'],
  // pydevd joins the groups into one tuple: `(x, lambda a, b: a,)`.
  ['joined', '{x, lambda a}{b: a}', /^café<function <lambda> at 0x[0-9A-Fa-f]+>$/]
];

describe.skipIf(!hasDebugpy())('Python logpoint validation against real debugpy (issue #1334) @requires-python', () => {
  let server: StdioClientHandle | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it('refuses the f-string forms on a launched session, then logs what each named replacement means', async () => {
    const env: Record<string, string> = {};
    ensurePythonOnPath(env);
    server = await startStdioClient({ name: 'python-logpoint-validation', env });
    const sessionId = await server.createSession('python', 'python-logpoint-validation');

    const started = await server.call('start_debugging', {
      scriptPath: FIXTURE,
      dapLaunchArgs: { stopOnEntry: true }
    });
    expect(started.success, JSON.stringify(started)).toBe(true);
    expect(started.state, JSON.stringify(started)).toBe('paused');

    for (const [logMessage, refusal] of REFUSALS) {
      await expect(
        server.client.callTool({
          name: 'set_breakpoint',
          arguments: { sessionId, file: FIXTURE, line: caseLine('repr'), logMessage }
        })
      ).rejects.toThrow(`Invalid logpoint: ${refusal}`);
    }

    // No refused logpoint was stored on the session.
    const emptyList = await server.call<ToolAnswer & { count: number }>('list_breakpoints');
    expect(emptyList.count).toBe(0);

    for (const [caseName, logMessage] of LOGPOINTS) {
      const bp = await server.call<BreakpointAnswer>('set_breakpoint', { file: FIXTURE, line: caseLine(caseName), logMessage });
      expect(bp.success, JSON.stringify(bp)).toBe(true);
      expect(bp.verified, JSON.stringify(bp)).toBe(true);
    }

    const resumed = await server.call('continue_execution');
    expect(resumed.success, JSON.stringify(resumed)).toBe(true);

    const ended = await server.call<EndAnswer>('wait_for_stop', { timeout: 20_000 });
    expect(ended.success, JSON.stringify(ended)).toBe(true);
    expect(ended.state, JSON.stringify(ended)).toBe('stopped');
    expect(ended.exitCode, JSON.stringify(ended)).toBe(0);

    const output = await server.call<OutputAnswer>('get_output', { since: 0 });
    const lines = (output.entries ?? []).map((entry) => entry.output.trim());
    expect(lines.length, JSON.stringify(output)).toBe(LOGPOINTS.length);
    LOGPOINTS.forEach(([caseName, , logged], k) => {
      if (typeof logged === 'string') expect(lines[k], caseName).toBe(logged);
      else expect(lines[k], caseName).toMatch(logged);
    });
  }, 60_000);
});

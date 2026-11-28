/**
 * Live `step_into` provenance notes for Python (`debugpy`) through the built MCP
 * server over stdio (issue #1328):
 *   (a) a line that calls a library function (`os.path.join`),
 *   (b) a line with no call,
 *   (c) a line that calls the program's own function,
 * each under the default launch (`justMyCode: true`) and under `justMyCode: false`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startStdioClient, type ToolAnswer } from '../../../test-utils/helpers/mcp-stdio-client.js';
import { ensurePythonOnPath } from './env-utils.js';

interface ChangedVariable {
  before?: string;
  after?: string;
  new?: true;
  gone?: true;
}

type StopAnswer = ToolAnswer & {
  pending?: boolean;
  note?: string;
  location?: { file: string; line: number };
  snapshot?: {
    frames?: Array<{ name: string; file: string; line: number }>;
    locals?: Record<string, string>;
    changedVariables?: Record<string, ChangedVariable>;
  };
};

function pythonPath(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  ensurePythonOnPath(env);
  return Object.fromEntries(Object.entries(env).filter(([key]) => key.toUpperCase() === 'PATH'));
}

const SCRIPT_SOURCE = [
  'import os',
  '',
  'def own_helper(x):',
  '    return x + 10  # MARK: in_own_helper',
  '',
  "def main(prefix='alpha'):",
  "    joined = os.path.join(prefix, 'beta')  # MARK: lib_call",
  '    plain = 1 + 2  # MARK: no_call',
  '    own = own_helper(plain)  # MARK: own_call',
  '    return f"{joined}:{own}"',
  '',
  'main()',
  ''
].join('\n');

const SCRIPT_LINES = SCRIPT_SOURCE.split('\n');

function lineOf(marker: string): number {
  const idx = SCRIPT_LINES.findIndex((line) => line.includes(`# MARK: ${marker}`));
  if (idx === -1) {
    throw new Error(`Missing marker ${marker}`);
  }
  return idx + 1;
}

describe('Python step_into provenance notes across library, plain, and program calls (#1328) @requires-python', () => {
  let tempDir = '';
  let scriptPath = '';

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-py-step-into-1328-'));
    scriptPath = path.join(tempDir, 'step_into_target.py');
    fs.writeFileSync(scriptPath, SCRIPT_SOURCE, 'utf8');
  });

  afterAll(() => {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  async function stepIntoFrom(marker: string, dapLaunchArgs?: Record<string, unknown>): Promise<StopAnswer> {
    const client = await startStdioClient({ name: 'py-step-into-1328', env: pythonPath() });
    try {
      await client.createSession('python', 'py-step-into-1328');
      const bp = await client.call('set_breakpoint', { file: scriptPath, line: lineOf(marker) });
      expect(bp.success, JSON.stringify(bp)).toBe(true);

      let launch = await client.call<StopAnswer>('start_debugging', {
        scriptPath,
        ...(dapLaunchArgs ? { dapLaunchArgs } : {})
      });
      expect(launch.success, JSON.stringify(launch)).toBe(true);
      if (launch.state !== 'paused') {
        launch = await client.call<StopAnswer>('wait_for_stop', { timeout: 15_000 });
      }
      expect(launch, JSON.stringify(launch)).toMatchObject({ success: true, state: 'paused' });
      expect(launch.location?.line, JSON.stringify(launch)).toBe(lineOf(marker));

      let step = await client.call<StopAnswer>('step_into', {});
      expect(step.success, JSON.stringify(step)).toBe(true);
      if (step.pending) {
        step = await client.call<StopAnswer>('wait_for_stop', { timeout: 15_000 });
      }
      expect(step.state, JSON.stringify(step)).toBe('paused');
      return step;
    } finally {
      await client.close();
    }
  }

  it('default launch (justMyCode: true): (a) library call, (b) no call, (c) own call', async () => {
    const libStep = await stepIntoFrom('lib_call');
    console.log('[Workflow Test] MATRIX python | default | (a) os.path.join -> note:', JSON.stringify(libStep.note ?? null));
    expect(libStep.location?.line).toBe(lineOf('no_call'));
    expect(libStep.snapshot?.changedVariables?.['(return) join']).toBeDefined();
    expect(libStep.note).toBe(
      "The step did not stop inside a called function ('join' returned). " +
        'If the line called into Python library or dependency code, debugpy ran through it without stopping ' +
        '(justMyCode is true by default); pass dapLaunchArgs: { justMyCode: false } to step into it.'
    );
    expect(libStep.note).not.toContain('No function was entered');

    const noCallStep = await stepIntoFrom('no_call');
    console.log('[Workflow Test] MATRIX python | default | (b) no call -> note:', JSON.stringify(noCallStep.note ?? null));
    expect(noCallStep.location?.line).toBe(lineOf('own_call'));
    expect(noCallStep.note).toBe(
      'The step did not stop inside a called function. ' +
        'If the line called into Python library or dependency code, debugpy ran through it without stopping ' +
        '(justMyCode is true by default); pass dapLaunchArgs: { justMyCode: false } to step into it.'
    );

    const ownCallStep = await stepIntoFrom('own_call');
    console.log('[Workflow Test] MATRIX python | default | (c) own call -> note:', JSON.stringify(ownCallStep.note ?? null));
    expect(ownCallStep.location?.line).toBe(lineOf('in_own_helper'));
    expect(ownCallStep.note).toBeUndefined();
  }, 120_000);

  it('justMyCode: false: (a) library call, (b) no call, (c) own call', async () => {
    const libStep = await stepIntoFrom('lib_call', { justMyCode: false });
    console.log('[Workflow Test] MATRIX python | justMyCode:false | (a) os.path.join -> note:', JSON.stringify(libStep.note ?? null));
    expect(libStep.location?.file ?? '').toMatch(/(?:nt|posix|generic)path\.py$/i);
    expect(libStep.snapshot?.frames?.[0]?.name).toBe('join');
    expect(libStep.note).toBeUndefined();

    const noCallStep = await stepIntoFrom('no_call', { justMyCode: false });
    console.log('[Workflow Test] MATRIX python | justMyCode:false | (b) no call -> note:', JSON.stringify(noCallStep.note ?? null));
    expect(noCallStep.location?.line).toBe(lineOf('own_call'));
    expect(noCallStep.note).toBe('The step did not stop inside a called function.');

    const ownCallStep = await stepIntoFrom('own_call', { justMyCode: false });
    console.log('[Workflow Test] MATRIX python | justMyCode:false | (c) own call -> note:', JSON.stringify(ownCallStep.note ?? null));
    expect(ownCallStep.location?.line).toBe(lineOf('in_own_helper'));
    expect(ownCallStep.note).toBeUndefined();
  }, 120_000);
});

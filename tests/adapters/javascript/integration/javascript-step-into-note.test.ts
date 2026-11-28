/**
 * Live `step_into` provenance notes for JavaScript (`js-debug`) through the
 * built MCP server over stdio (issue #1328):
 *   (a) a line that calls a library / dependency function (`path.join` and `node_modules`),
 *   (b) a line with no call,
 *   (c) a line that calls the program's own function,
 * each under the default launch (`justMyCode: true`) and under `justMyCode: false`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startStdioClient, type ToolAnswer } from '../../../test-utils/helpers/mcp-stdio-client.js';

type StopAnswer = ToolAnswer & {
  pending?: boolean;
  note?: string;
  location?: { file: string; line: number };
  snapshot?: {
    frames?: Array<{ name: string; file: string; line: number }>;
  };
};

const DEP_SOURCE = [
  "'use strict';",
  'function depJoin(a, b) {',
  '  return `${a}/${b}`; // MARK: in_dep',
  '}',
  'module.exports = { depJoin };',
  ''
].join('\n');

const SCRIPT_SOURCE = [
  "'use strict';",
  "const path = require('node:path');",
  "const { depJoin } = require('tiny-dep');",
  '',
  'function ownHelper(x) {',
  '  return x + 10; // MARK: in_own_helper',
  '}',
  '',
  'function main() {',
  "  const joined = path.join('alpha', 'beta'); // MARK: lib_call",
  "  const viaDep = depJoin('alpha', 'beta'); // MARK: dep_call",
  '  const plain = 1 + 2; // MARK: no_call',
  '  const own = ownHelper(plain); // MARK: own_call',
  '  return `${joined}:${viaDep}:${own}`;',
  '}',
  '',
  'main();',
  ''
].join('\n');

const SCRIPT_LINES = SCRIPT_SOURCE.split('\n');

function lineOf(marker: string): number {
  const idx = SCRIPT_LINES.findIndex((line) => line.includes(`// MARK: ${marker}`));
  if (idx === -1) {
    throw new Error(`Missing marker ${marker}`);
  }
  return idx + 1;
}

describe('JavaScript step_into provenance notes across library, dependency, plain, and program calls (#1328) @requires-node', () => {
  let tempDir = '';
  let scriptPath = '';

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-js-step-into-1328-'));
    const depDir = path.join(tempDir, 'node_modules', 'tiny-dep');
    fs.mkdirSync(depDir, { recursive: true });
    fs.writeFileSync(path.join(depDir, 'package.json'), JSON.stringify({ name: 'tiny-dep', version: '1.0.0', main: 'index.cjs' }), 'utf8');
    fs.writeFileSync(path.join(depDir, 'index.cjs'), DEP_SOURCE, 'utf8');
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'step-into-fixture', private: true }), 'utf8');
    scriptPath = path.join(tempDir, 'step_into_target.cjs');
    fs.writeFileSync(scriptPath, SCRIPT_SOURCE, 'utf8');
  });

  afterAll(() => {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  async function stepIntoFrom(marker: string, dapLaunchArgs?: Record<string, unknown>): Promise<StopAnswer> {
    const client = await startStdioClient({ name: 'js-step-into-1328', callTimeoutMs: 60_000 });
    try {
      await client.createSession('javascript', 'js-step-into-1328');
      const bp = await client.call('set_breakpoint', { file: scriptPath, line: lineOf(marker) });
      expect(bp.success, JSON.stringify(bp)).toBe(true);

      let launch = await client.call<StopAnswer>('start_debugging', {
        scriptPath,
        ...(dapLaunchArgs ? { dapLaunchArgs } : {})
      });
      expect(launch.success, JSON.stringify(launch)).toBe(true);
      if (launch.state !== 'paused') {
        launch = await client.call<StopAnswer>('wait_for_stop', { timeout: 20_000 });
      }
      expect(launch, JSON.stringify(launch)).toMatchObject({ success: true, state: 'paused' });
      expect(launch.location?.line, JSON.stringify(launch)).toBe(lineOf(marker));

      let step = await client.call<StopAnswer>('step_into', {});
      expect(step.success, JSON.stringify(step)).toBe(true);
      if (step.pending) {
        step = await client.call<StopAnswer>('wait_for_stop', { timeout: 60_000 });
      }
      expect(step.state, JSON.stringify(step)).toBe('paused');
      return step;
    } finally {
      await client.close();
    }
  }

  it('default launch (justMyCode: true): (a) library and node_modules calls, (b) no call, (c) own call', async () => {
    const expectedFilteredNote =
      "The stop is in 'main' at the same visible call-stack depth as before step_into. " +
      'If the line called into Node internals or node_modules, the debugger ran through that skipped code without stopping; ' +
      'pass dapLaunchArgs: { justMyCode: false } to step into it.';

    const libStep = await stepIntoFrom('lib_call');
    console.log('[Workflow Test] MATRIX javascript | default | (a) path.join -> note:', JSON.stringify(libStep.note ?? null));
    expect(libStep.location?.line).toBe(lineOf('dep_call'));
    expect(libStep.note).toBe(expectedFilteredNote);
    expect(libStep.note).not.toContain('No function was entered');
    expect(libStep.note).not.toContain('did not stop inside a called function');

    const depStep = await stepIntoFrom('dep_call');
    console.log('[Workflow Test] MATRIX javascript | default | (a2) node_modules depJoin -> note:', JSON.stringify(depStep.note ?? null));
    expect(depStep.location?.line).toBe(lineOf('no_call'));
    expect(depStep.note).toBe(expectedFilteredNote);

    const noCallStep = await stepIntoFrom('no_call');
    console.log('[Workflow Test] MATRIX javascript | default | (b) no call -> note:', JSON.stringify(noCallStep.note ?? null));
    expect(noCallStep.location?.line).toBe(lineOf('own_call'));
    expect(noCallStep.note).toBe(expectedFilteredNote);

    const ownCallStep = await stepIntoFrom('own_call');
    console.log('[Workflow Test] MATRIX javascript | default | (c) own call -> note:', JSON.stringify(ownCallStep.note ?? null));
    expect(ownCallStep.location?.line).toBe(lineOf('in_own_helper'));
    expect(ownCallStep.note).toBeUndefined();
  }, 150_000);

  it('justMyCode: false: (a) library and node_modules calls, (b) no call, (c) own call', async () => {
    const libStep = await stepIntoFrom('lib_call', { justMyCode: false });
    console.log('[Workflow Test] MATRIX javascript | justMyCode:false | (a) path.join -> note:', JSON.stringify(libStep.note ?? null));
    expect(libStep.location?.file ?? '').toMatch(/node_internals|^node:/);
    expect(libStep.note).toMatch(/^Paused inside an internal frame /);
    expect(libStep.note).not.toContain('at the same visible call-stack depth as before step_into');
    expect(libStep.note).not.toContain('did not stop inside a called function');

    const depStep = await stepIntoFrom('dep_call', { justMyCode: false });
    console.log('[Workflow Test] MATRIX javascript | justMyCode:false | (a2) node_modules depJoin -> note:', JSON.stringify(depStep.note ?? null));
    expect(depStep.location?.file ?? '').toMatch(/tiny-dep[\\/]index\.cjs$/);
    expect(depStep.note).toMatch(/^Paused inside an internal frame 'depJoin'/);
    expect(depStep.note).not.toContain('at the same visible call-stack depth as before step_into');
    expect(depStep.note).not.toContain('did not stop inside a called function');

    const noCallStep = await stepIntoFrom('no_call', { justMyCode: false });
    console.log('[Workflow Test] MATRIX javascript | justMyCode:false | (b) no call -> note:', JSON.stringify(noCallStep.note ?? null));
    expect(noCallStep.location?.line).toBe(lineOf('own_call'));
    expect(noCallStep.note).toBe("The stop is in 'main' at the same visible call-stack depth as before step_into.");

    const ownCallStep = await stepIntoFrom('own_call', { justMyCode: false });
    console.log('[Workflow Test] MATRIX javascript | justMyCode:false | (c) own call -> note:', JSON.stringify(ownCallStep.note ?? null));
    expect(ownCallStep.location?.line).toBe(lineOf('in_own_helper'));
    expect(ownCallStep.note).toBeUndefined();
  }, 150_000);
});

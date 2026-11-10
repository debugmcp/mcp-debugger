import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  APPLICABLE_SCENARIOS,
  collectChecks,
  failingChecks,
  judgeRequirements,
  judgeScenario,
  parseBaseline,
  parseRequirementsSummary,
  parseSummary
} from '../../../scripts/mcp-conformance.mjs';

const REQUIREMENTS_OUTPUT = [
  'Running requirements 2026-07-28 (50 scenarios) against http://127.0.0.1:3997/mcp',
  '=== SUMMARY ===',
  '✗ server-stateless: 24 passed, 4 failed',
  '✓ tools-list: 4 passed, 0 failed',
  '✗ tools-call-simple-text: 1 passed, 1 failed',
  '✓ caching: 7 passed, 0 failed',
  '✗ tasks-lifecycle: 1 passed, 8 failed',
  '',
  'Total: 37 passed, 13 failed',
  '',
  'Not scored for 2026-07-28: 1 scenario(s) run, 1 failing. These do not affect conformance.',
  '  ✗ tasks-lifecycle (extension)',
].join('\r\n');

const BASELINE = [
  '# fixtures this server does not have',
  'server:',
  '  - tools-call-simple-text                 # tools/call test_simple_text',
  '  - server-stateless:ServerRejectsUndeclaredCapability   # test_missing_capability',
  '  - server-stateless:ServerNoLogWithoutLogLevel',
].join('\n');

const PASSING = [
  "Running client scenario 'ping' against server: http://127.0.0.1:3919/mcp",
  'Checks:',
  '2026-10-27T13:02:57.326Z [ping] SUCCESS Server responds to ping requests',
  '',
  'Test Results:',
  'Passed: 1/1, 0 failed, 0 warnings',
  // The CLI aborts at exit on Windows even after a pass; the summary is what counts.
  'Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\\win\\async.c, line 76',
].join('\r\n');

describe('mcp-conformance runner: reading the CLI summary', () => {
  it('reads the counts out of the summary line, CRLF included', () => {
    expect(parseSummary(PASSING)).toEqual({ passed: 1, total: 1, failed: 0 });
  });

  it('answers undefined when the output carries no summary (the CLI crashed before reporting)', () => {
    expect(parseSummary('Running client scenario ...\nSegmentation fault')).toBeUndefined();
  });

  it('passes a scenario only when it ran at least one check and none failed', () => {
    expect(judgeScenario('ping', PASSING)).toEqual({ name: 'ping', ok: true, summary: { passed: 1, total: 1, failed: 0 } });
    expect(judgeScenario('tools-list', 'Passed: 0/1, 1 failed, 0 warnings')).toMatchObject({ ok: false, reason: '1 failed check(s)' });
    // server-sse-polling runs no checks without the reference server's tool: not a pass.
    expect(judgeScenario('server-sse-polling', 'Passed: 0/0, 0 failed, 0 warnings')).toMatchObject({ ok: false, reason: 'the scenario ran no checks' });
    expect(judgeScenario('ping', 'no output')).toMatchObject({ ok: false, reason: 'no summary line in the CLI output' });
  });

  it('keeps the fixture-bound scenarios out of the default list', () => {
    for (const name of APPLICABLE_SCENARIOS) {
      expect(name).not.toMatch(/^tools-call|^prompts-get|^resources-read|^resources-(un)?subscribe|logging|completion|elicitation|json-schema/);
    }
    expect(APPLICABLE_SCENARIOS).toContain('dns-rebinding-protection');
  });
});

describe('mcp-conformance runner: the 2026-07-28 requirements lane (issue #1025)', () => {
  it('reads the per-scenario verdict lines and the not-scored list, CRLF included', () => {
    const summary = parseRequirementsSummary(REQUIREMENTS_OUTPUT)!;
    expect(summary.scenarios).toEqual([
      { name: 'server-stateless', passed: 24, failed: 4 },
      { name: 'tools-list', passed: 4, failed: 0 },
      { name: 'tools-call-simple-text', passed: 1, failed: 1 },
      { name: 'caching', passed: 7, failed: 0 },
      { name: 'tasks-lifecycle', passed: 1, failed: 8 },
    ]);
    expect([...summary.notScored]).toEqual(['tasks-lifecycle']);
    expect(parseRequirementsSummary('Running requirements ...\nSegmentation fault')).toBeUndefined();
  });

  it('reads whole-scenario and per-check entries out of the baseline, comments stripped', () => {
    const baseline = parseBaseline(BASELINE);
    expect(baseline.get('tools-call-simple-text')).toBe('all');
    expect(baseline.get('server-stateless')).toEqual(new Set(['ServerRejectsUndeclaredCapability', 'ServerNoLogWithoutLogLevel']));
    expect(baseline.has('fixtures')).toBe(false);
  });

  it('names the failing checks of a checks.json, whichever shape the CLI wrote; a SKIPPED check is not a failure', () => {
    const checks = [{ name: 'A', status: 'SUCCESS' }, { name: 'B', status: 'FAILURE' }, { name: 'C', status: 'SKIPPED' }];
    expect(failingChecks(checks)).toEqual(['B']);
    expect(failingChecks({ checks })).toEqual(['B']);
    expect(failingChecks(undefined)).toEqual([]);
  });

  describe('collecting the per-scenario checks.json files', () => {
    const dirs: string[] = [];
    afterEach(() => {
      for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    });

    it('keys each checks.json by its scenario, read out of the CLI folder name server-<scenario>-<ISO stamp>', () => {
      // Measured 2026-11-10 against 0.2.0-alpha.12: `--output-dir` holds one folder per scenario,
      // `server-server-stateless-2026-11-10T02-36-40-817Z/checks.json` (colons and dots of the
      // ISO timestamp replaced by dashes); a scenario name itself carries dashes.
      const dir = mkdtempSync(path.join(os.tmpdir(), 'mcp-conformance-test-'));
      dirs.push(dir);
      const folder = path.join(dir, 'server-server-stateless-2026-11-10T02-36-40-817Z');
      mkdirSync(folder);
      writeFileSync(path.join(folder, 'checks.json'), JSON.stringify([
        { id: 'sep-2575-a', name: 'ServerRejectsUndeclaredCapability', status: 'FAILURE' },
        { id: 'sep-2575-b', name: 'ServerSendsPromptsListChangedOnSubscription', status: 'SKIPPED' },
        { id: 'sep-2575-c', name: 'StatelessNoSessionId', status: 'SUCCESS' },
      ]));
      const other = path.join(dir, 'server-tools-list-2026-11-10T02-36-41-000Z');
      mkdirSync(other);
      writeFileSync(path.join(other, 'checks.json'), JSON.stringify([{ name: 'ToolsListOk', status: 'SUCCESS' }]));

      const byScenario = collectChecks(dir);
      expect(byScenario.get('server-stateless')).toEqual(['ServerRejectsUndeclaredCapability']);
      expect(byScenario.get('tools-list')).toEqual([]);
      expect(collectChecks(path.join(dir, 'does-not-exist')).size).toBe(0);
    });
  });

  it('cannot judge a per-check entry without the scenario\'s checks.json, and says so instead of calling it passed', () => {
    const summary = parseRequirementsSummary(REQUIREMENTS_OUTPUT)!;
    const problems = judgeRequirements(summary, parseBaseline(BASELINE), () => []);
    expect(problems).toEqual([
      expect.stringContaining('server-stateless: 4 failed check(s) but no checks.json was written for it'),
    ]);
    expect(problems.join('\n')).not.toContain('listed as an expected failure but it passed');
  });

  it('passes when every failure is expected and every expectation still fails', () => {
    const summary = parseRequirementsSummary(REQUIREMENTS_OUTPUT)!;
    const baseline = parseBaseline(BASELINE);
    const checks = new Map([['server-stateless', ['ServerRejectsUndeclaredCapability', 'ServerNoLogWithoutLogLevel']]]);
    // Two of the four server-stateless failures are listed by check; the other two are not.
    expect(judgeRequirements(summary, baseline, (name) => checks.get(name) ?? [])).toEqual([]);
  });

  it('fails on an unlisted failure, a listed check that does not fail, and a stale whole-scenario entry', () => {
    const summary = parseRequirementsSummary(REQUIREMENTS_OUTPUT)!;
    const checks = new Map([['server-stateless', ['ServerRejectsUndeclaredCapability', 'SomethingNew']]]);
    const problems = judgeRequirements(
      summary,
      parseBaseline(['server:', '  - caching', '  - server-stateless:ServerRejectsUndeclaredCapability', '  - server-stateless:ServerNoLogWithoutLogLevel'].join('\n')),
      (name) => checks.get(name) ?? []
    );
    expect(problems).toEqual(expect.arrayContaining([
      expect.stringContaining('server-stateless: 4 failed check(s) not in the baseline (SomethingNew)'),
      expect.stringContaining('server-stateless:ServerNoLogWithoutLogLevel: listed as an expected failure but it passed'),
      expect.stringContaining('tools-call-simple-text: 1 failed check(s) not in the baseline'),
      expect.stringContaining('caching: listed as an expected failure but it passed'),
    ]));
    // A not-scored scenario never counts, listed or not.
    expect(problems.join('\n')).not.toContain('tasks-lifecycle');
  });
});

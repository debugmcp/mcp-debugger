import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  APPLICABLE_SCENARIOS,
  baselineReport,
  judgeBaselineRun,
  judgeScenario,
  parseSummary,
  requirementsArgs
} from '../../../scripts/mcp-conformance.mjs';

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

// The tail of a `--requirements … --expected-failures` run, as 0.2.0-alpha.12 prints it
// (colour codes included: the CLI colours these lines whatever NO_COLOR says).
const BASELINE_PASS = [
  'Running requirements 2026-07-28 (50 scenarios) against http://127.0.0.1:3997/mcp',
  '✗ server-stateless: 24 passed, 4 failed',
  '✓ tools-list: 4 passed, 0 failed',
  '',
  'Total: 104 passed, 66 failed',
  '',
  '\u001b[33mExpected failures (in baseline):\u001b[0m',
  '  ~ server-stateless:sep-2575-server-no-log-without-loglevel',
  '  ~ tools-call-simple-text',
  '',
  '\u001b[32mBaseline check passed: all failures are expected.\u001b[0m',
].join('\r\n');

const BASELINE_FAIL = [
  'Running requirements 2026-07-28 (50 scenarios) against http://127.0.0.1:3997/mcp',
  '✓ sep-2164-resource-not-found: 3 passed, 0 failed',
  '',
  'Total: 104 passed, 66 failed',
  '',
  '\u001b[33mExpected failures (in baseline):\u001b[0m',
  '  ~ tools-call-simple-text',
  '',
  '\u001b[31mStale baseline entries (now passing - remove from baseline):\u001b[0m',
  '  ✓ tools-call-image',
  '',
  '\u001b[31mUnexpected failures (not in baseline):\u001b[0m',
  '  ✗ sep-2164-resource-not-found',
  '',
  '\u001b[31mBaseline is stale: update your expected-failures file to remove passing entries.\u001b[0m',
  '',
  '\u001b[31mUnexpected failures detected: these are not in your expected-failures baseline.\u001b[0m',
].join('\n');

// Node 23 to 24.19 and 26.0 to 26.6 abort inside process.exit on Windows (nodejs/node#56645).
const EXIT_ABORT = 'Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\\win\\async.c, line 76';
const ABORT_STATUS = 3221226505;

describe('mcp-conformance runner: the 2026-07-28 requirements lane (issue #1025)', () => {
  // The suite judges its own baseline: it reads the file, fails on a failure or
  // warning that is not listed and on a listed entry that passes, and says so in
  // its exit code. This runner adds no judging of its own.
  it('hands the suite its own baseline by a path relative to the repository root', () => {
    expect(requirementsArgs('2026-07-28', 43210)).toEqual([
      'server',
      '--url', 'http://127.0.0.1:43210/mcp',
      '--requirements', '2026-07-28',
      '--expected-failures', 'scripts/conformance/expected-failures-2026-07-28.yaml'
    ]);
  });

  it('takes the exit code as the verdict', () => {
    expect(judgeBaselineRun({ code: 0, output: BASELINE_PASS })).toEqual({ ok: true, abortedAtExit: false, report: '' });
    expect(judgeBaselineRun({ code: 1, output: BASELINE_FAIL })).toMatchObject({ ok: false, abortedAtExit: false });
  });

  it('never calls a run a pass on its printed text when the exit code says it failed', () => {
    // A pass line in the output of a run that exited 1 for another reason proves nothing.
    expect(judgeBaselineRun({ code: 1, output: BASELINE_PASS }).ok).toBe(false);
  });

  it('reports a failed run in the words of the suite: its stale and unexpected lists, colour stripped', () => {
    const { report } = judgeBaselineRun({ code: 1, output: BASELINE_FAIL });

    expect(report).toMatch(/^Stale baseline entries \(now passing - remove from baseline\):/);
    expect(report).toContain('✓ tools-call-image');
    expect(report).toContain('✗ sep-2164-resource-not-found');
    expect(report).not.toContain('\u001b');
    expect(report).not.toContain('Expected failures (in baseline)');
  });

  it('reports the tail of the output when the suite never reached its verdict', () => {
    const output = ['npm error code E404', 'npm error 404 Not Found'].join('\n');

    expect(baselineReport(output)).toBe(output);
    expect(judgeBaselineRun({ code: 1, output })).toMatchObject({ ok: false, report: output });
  });

  describe('a Node build that aborts at exit on Windows', () => {
    // The process dies inside process.exit, after the suite printed its verdict, so
    // the exit status says nothing. Only then is the suite's closing line the verdict.
    it('reads the closing line: a pass is a pass, and the answer says how it was read', () => {
      const output = `${BASELINE_PASS}\r\n${EXIT_ABORT}`;

      expect(judgeBaselineRun({ code: ABORT_STATUS, output })).toEqual({ ok: true, abortedAtExit: true, report: '' });
    });

    it('still fails a run whose closing line is not the pass line', () => {
      const output = `${BASELINE_FAIL}\n${EXIT_ABORT}`;

      const verdict = judgeBaselineRun({ code: ABORT_STATUS, output });
      expect(verdict).toMatchObject({ ok: false, abortedAtExit: true });
      expect(verdict.report).toContain('✗ sep-2164-resource-not-found');
    });
  });

  describe('the baseline file', () => {
    const text = readFileSync(
      fileURLToPath(new URL('../../../scripts/conformance/expected-failures-2026-07-28.yaml', import.meta.url)),
      'utf8'
    );
    const entries = text.split(/\r?\n/).filter((line) => /^\s+- /.test(line));

    it('gives every entry the fixture or feature that makes it untestable here', () => {
      for (const line of entries) {
        expect(line, line).toMatch(/^\s+- [a-z0-9-]+:[a-z0-9-]+\s+# \S/);
      }
      expect(entries.length).toBeGreaterThan(0);
    });

    // A whole-scenario entry excuses every check in the scenario. Naming one
    // check keeps the others enforced — above all wire-schema-valid, the suite's
    // check that every message this server sent is valid per the spec's schema.
    it('excuses one check per entry, never a whole scenario, and never the schema check', () => {
      for (const name of entries.map((line) => /- (\S+)/.exec(line)![1])) {
        expect(name, name).toMatch(/^[a-z0-9-]+:[a-z0-9-]+$/);
        expect(name, name).not.toMatch(/:wire-schema-valid$/);
      }
    });

    it('lists each entry once, and no scenario both whole and by check (the suite refuses that)', () => {
      const names = entries.map((line) => /- (\S+)/.exec(line)![1]);
      expect(new Set(names).size).toBe(names.length);
      const whole = new Set(names.filter((name) => !name.includes(':')));
      for (const name of names.filter((entry) => entry.includes(':'))) {
        expect(whole.has(name.split(':')[0]), name).toBe(false);
      }
    });

    it('names checks by the suite\'s check ids, which is what the suite matches (ids are kebab-case; names are CamelCase)', () => {
      const checks = entries.map((line) => /- (\S+)/.exec(line)![1].split(':')[1]);
      for (const id of checks) {
        expect(id, id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)+$/);
      }
    });
  });
});

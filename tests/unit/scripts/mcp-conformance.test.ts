import { describe, expect, it } from 'vitest';
import { APPLICABLE_SCENARIOS, judgeScenario, parseSummary } from '../../../scripts/mcp-conformance.mjs';

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

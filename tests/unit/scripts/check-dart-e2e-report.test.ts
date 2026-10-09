import { describe, expect, it } from 'vitest';
import { checkDartE2eReport } from '../../../scripts/check-dart-e2e-report.mjs';

function report(status = 'passed') {
  return {
    success: true,
    testResults: [
      { name: '/repo/tests/e2e/mcp-server-smoke-dart.test.ts', assertionResults: [{ title: 'launches hello', status }] },
      { name: '/repo/tests/e2e/mcp-server-smoke-dart-attach.test.ts', assertionResults: [{ title: 'attaches by info file', status: 'passed' }] },
      { name: 'C:\\repo\\tests\\e2e\\mcp-server-logpoints.test.ts', assertionResults: [
        { title: 'logs (dart)', status: 'passed' },
        { title: 'logs (python)', status: 'pending' }
      ] }
    ]
  };
}

describe('Dart host validation report', () => {
  it('requires every Dart case while ignoring other language selections', () => {
    expect(checkDartE2eReport(report())).toBe(3);
  });
  it.each(['pending', 'skipped', 'failed', 'todo'])('rejects %s Dart cases', status => {
    expect(() => checkDartE2eReport(report(status))).toThrow('validation incomplete');
  });
  it('rejects missing suites, empty selections and unsuccessful runs', () => {
    expect(() => checkDartE2eReport({ success: true, testResults: [] })).toThrow('No Dart cases');
    const empty = report();
    empty.testResults[2].assertionResults = [];
    expect(() => checkDartE2eReport(empty)).toThrow('No Dart cases');
    expect(() => checkDartE2eReport({ ...report(), success: false })).toThrow('unsuccessful run');
  });
});

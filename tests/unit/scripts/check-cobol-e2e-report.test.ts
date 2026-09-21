import { describe, expect, it } from 'vitest';
import { checkCobolE2eReport } from '../../../scripts/check-cobol-e2e-report.mjs';

function report(status = 'passed') {
  return {
    success: true,
    testResults: [
      { name: '/repo/tests/e2e/mcp-server-smoke-cobol.test.ts', assertionResults: [{ title: 'source launch', status }] },
      { name: 'C:\\repo\\tests\\e2e\\mcp-server-logpoints.test.ts', assertionResults: [
        { title: 'logs (cobol)', status: 'passed' },
        { title: 'logs (python)', status: 'pending' }
      ] }
    ]
  };
}

describe('COBOL host validation report', () => {
  it('requires every COBOL case while ignoring other language selections', () => {
    expect(checkCobolE2eReport(report())).toBe(2);
  });
  it.each(['pending', 'skipped', 'failed', 'todo'])('rejects %s COBOL cases', status => {
    expect(() => checkCobolE2eReport(report(status))).toThrow('validation incomplete');
  });
  it('rejects missing suites, empty selections and unsuccessful runs', () => {
    expect(() => checkCobolE2eReport({ success: true, testResults: [] })).toThrow('No COBOL cases');
    const empty = report();
    empty.testResults[1].assertionResults = [];
    expect(() => checkCobolE2eReport(empty)).toThrow('No COBOL cases');
    expect(() => checkCobolE2eReport({ ...report(), success: false })).toThrow('unsuccessful run');
  });
});

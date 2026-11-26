import { describe, expect, it } from 'vitest';
import { checkHostE2eReport } from '../../../scripts/check-host-e2e-report.mjs';

function report(language: 'java' | 'dotnet' = 'java') {
  const files: Array<[string, number]> = language === 'java' ? [
    ['mcp-server-smoke-java.test.ts', 8],
    ['mcp-server-smoke-java-attach.test.ts', 3],
    ['mcp-server-smoke-java-evaluate.test.ts', 1],
    ['mcp-server-smoke-java-event-race.test.ts', 1],
    ['mcp-server-smoke-java-function-bp.test.ts', 4],
    ['mcp-server-smoke-java-inner-class.test.ts', 1],
    ['mcp-server-smoke-java-pause.test.ts', 2],
    ['mcp-server-smoke-java-redefine.test.ts', 2]
  ] : [
    ['mcp-server-smoke-dotnet.test.ts', 5],
    ['mcp-server-smoke-dotnet-attach.test.ts', 1]
  ];
  return {
    success: true,
    testResults: files.map(([filename, count], index) => ({
      name: index % 2 ? `C:\\repo\\tests\\e2e\\${filename}` : `/repo/tests/e2e/${filename}`,
      status: 'passed',
      assertionResults: Array.from({ length: count }, (_, test) => ({ title: `case ${test + 1}`, status: 'passed' }))
    }))
  };
}

describe('Java and .NET host validation report', () => {
  it('accepts all eight Java files with 22 passing cases', () => {
    expect(checkHostE2eReport(report(), 'java')).toBe(22);
  });
  it('accepts both .NET files with six passing cases', () => {
    expect(checkHostE2eReport(report('dotnet'), 'dotnet')).toBe(6);
  });
  it.each(['pending', 'skipped', 'failed', 'todo'])('rejects %s cases', status => {
    const incomplete = report();
    incomplete.testResults[0].assertionResults[0].status = status;
    expect(() => checkHostE2eReport(incomplete, 'java')).toThrow(`case 1: ${status}`);
  });
  it('rejects a skipped file reported as passed with every case skipped', () => {
    const skipped = report();
    for (const test of skipped.testResults[0].assertionResults) test.status = 'skipped';
    expect(() => checkHostE2eReport(skipped, 'java')).toThrow('case 1: skipped');
  });
  it('rejects a missing file', () => {
    const missing = report();
    missing.testResults.shift();
    expect(() => checkHostE2eReport(missing, 'java')).toThrow('Expected one result for mcp-server-smoke-java.test.ts, found 0');
  });
  it('rejects a file listed twice', () => {
    const duplicate = report();
    duplicate.testResults.push(duplicate.testResults[0]);
    expect(() => checkHostE2eReport(duplicate, 'java')).toThrow('Expected one result for mcp-server-smoke-java.test.ts, found 2');
  });
  it('rejects fewer cases than the minimum', () => {
    const short = report('dotnet');
    short.testResults[0].assertionResults.pop();
    expect(() => checkHostE2eReport(short, 'dotnet')).toThrow('require at least 5 cases');
  });
  it('rejects an unsuccessful run even when every case passed', () => {
    expect(() => checkHostE2eReport({ ...report(), success: false }, 'java')).toThrow('Vitest reported an unsuccessful run');
  });
  it('rejects a report without a success field even when every case passed', () => {
    const { testResults } = report();
    expect(() => checkHostE2eReport({ testResults }, 'java')).toThrow('Vitest reported an unsuccessful run');
  });
  it('rejects an unknown lane name', () => {
    expect(() => checkHostE2eReport(report(), 'python')).toThrow('Unknown host lane: python');
  });
});

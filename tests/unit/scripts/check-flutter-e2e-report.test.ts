import { describe, expect, it } from 'vitest';
import { checkFlutterE2eReport } from '../../../scripts/check-flutter-e2e-report.mjs';

function report(widgetStatus = 'passed', desktopStatus = 'pending') {
  return {
    success: true,
    testResults: [
      { name: 'C:\\repo\\tests\\e2e\\mcp-server-smoke-flutter.test.ts', assertionResults: [
        { title: 'widget test: breaks in the test body', fullName: 'MCP Server Flutter widget test: breaks in the test body', status: widgetStatus },
        { title: 'widget test: stops at entry', fullName: 'MCP Server Flutter widget test: stops at entry', status: 'passed' },
        { title: 'flutter run: breaks in build()', fullName: 'MCP Server Flutter desktop (windows) flutter run: breaks in build()', status: desktopStatus },
      ] },
      { name: '/repo/tests/e2e/mcp-server-smoke-dart.test.ts', assertionResults: [{ title: 'launches hello', status: 'passed' }] },
    ],
  };
}

describe('Flutter host validation report', () => {
  it('requires every widget-test case and lets the desktop cases be skipped', () => {
    expect(checkFlutterE2eReport(report())).toBe(2);
    expect(checkFlutterE2eReport(report('passed', 'skipped'))).toBe(2);
  });
  it.each(['pending', 'skipped', 'failed', 'todo'])('rejects %s widget-test cases', status => {
    expect(() => checkFlutterE2eReport(report(status))).toThrow('validation incomplete');
  });
  it('rejects a failed desktop case even though it is not required', () => {
    expect(() => checkFlutterE2eReport(report('passed', 'failed'))).toThrow('cases failed');
  });
  it('rejects a missing suite and an unsuccessful run', () => {
    expect(() => checkFlutterE2eReport({ success: true, testResults: [] })).toThrow('No Flutter widget-test cases');
    expect(() => checkFlutterE2eReport({ ...report(), success: false })).toThrow('unsuccessful run');
  });
});

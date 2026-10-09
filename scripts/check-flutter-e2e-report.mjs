/**
 * Reject missing, skipped, or failed Flutter widget-test cases in the dedicated host CI lane
 * (issue #790, M2). The desktop cases need a display and a platform toolchain the lane has not,
 * so only the `widget test:` cases are required there; the rest may be skipped but never failed.
 */
import { readFileSync } from 'node:fs';
import { isMain } from './lib/is-main.mjs';

export function checkFlutterE2eReport(report) {
  const suite = report.testResults?.find(result => result.name?.replace(/\\/g, '/').endsWith('/mcp-server-smoke-flutter.test.ts'));
  const all = suite?.assertionResults ?? [];
  const required = all.filter(test => /widget test:/i.test(test.fullName ?? test.title ?? ''));
  if (required.length === 0) throw new Error('No Flutter widget-test cases recorded for mcp-server-smoke-flutter.test.ts');
  const incomplete = required.filter(test => test.status !== 'passed');
  if (incomplete.length) {
    throw new Error(`Flutter validation incomplete: ${incomplete.map(test => `${test.title}: ${test.status}`).join(', ')}`);
  }
  const failed = all.filter(test => test.status === 'failed');
  if (failed.length) throw new Error(`Flutter cases failed: ${failed.map(test => test.title).join(', ')}`);
  if (report.success !== true) throw new Error('Vitest reported an unsuccessful run');
  return required.length;
}

if (isMain(import.meta.url)) {
  try {
    const filename = process.argv[2];
    if (!filename) throw new Error('Usage: node scripts/check-flutter-e2e-report.mjs <vitest-report.json>');
    const passed = checkFlutterE2eReport(JSON.parse(readFileSync(filename, 'utf8')));
    console.log(`Flutter host validation: ${passed} widget-test case(s) passed`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

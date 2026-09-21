/** Reject missing, skipped, or failed COBOL cases in the dedicated host CI lane. */
import { readFileSync } from 'node:fs';
import { isMain } from './lib/is-main.mjs';

export function checkCobolE2eReport(report) {
  const expected = [
    ['mcp-server-smoke-cobol.test.ts', () => true],
    ['mcp-server-logpoints.test.ts', test => /\(cobol\)/i.test(test.fullName ?? test.title ?? '')]
  ];
  let passed = 0;
  for (const [filename, select] of expected) {
    const suite = report.testResults?.find(result => result.name?.replace(/\\/g, '/').endsWith(`/${filename}`));
    const tests = suite?.assertionResults?.filter(select) ?? [];
    if (tests.length === 0) throw new Error(`No COBOL cases recorded for ${filename}`);
    const incomplete = tests.filter(test => test.status !== 'passed');
    if (incomplete.length) {
      throw new Error(`COBOL validation incomplete in ${filename}: ${incomplete.map(test => `${test.title}: ${test.status}`).join(', ')}`);
    }
    passed += tests.length;
  }
  if (report.success !== true) throw new Error('Vitest reported an unsuccessful run');
  return passed;
}

if (isMain(import.meta.url)) {
  try {
    const filename = process.argv[2];
    if (!filename) throw new Error('Usage: node scripts/check-cobol-e2e-report.mjs <vitest-report.json>');
    const passed = checkCobolE2eReport(JSON.parse(readFileSync(filename, 'utf8')));
    console.log(`COBOL host validation: ${passed} passed, 0 skipped`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

/** Require every Java/.NET host smoke case to pass (issue #1125).
 * Dart's checker permits cases excluded by its title filter; these lanes do not.
 */
import { readFileSync } from 'node:fs';
import { isMain } from './lib/is-main.mjs';

const EXPECTED = {
  java: {
    'mcp-server-smoke-java.test.ts': 8,
    'mcp-server-smoke-java-attach.test.ts': 3,
    'mcp-server-smoke-java-evaluate.test.ts': 1,
    'mcp-server-smoke-java-event-race.test.ts': 1,
    'mcp-server-smoke-java-function-bp.test.ts': 4,
    'mcp-server-smoke-java-inner-class.test.ts': 1,
    'mcp-server-smoke-java-pause.test.ts': 2,
    'mcp-server-smoke-java-redefine.test.ts': 2
  },
  dotnet: {
    'mcp-server-smoke-dotnet.test.ts': 5,
    'mcp-server-smoke-dotnet-attach.test.ts': 1
  }
};

export function checkHostE2eReport(report, language) {
  const expected = EXPECTED[language];
  if (!expected) throw new Error(`Unknown host lane: ${language}`);
  let passed = 0;
  for (const [filename, minimum] of Object.entries(expected)) {
    const suites = report.testResults?.filter(result => result.name?.replace(/\\/g, '/').endsWith(`/${filename}`)) ?? [];
    if (suites.length !== 1) throw new Error(`Expected one result for ${filename}, found ${suites.length}`);
    const suite = suites[0];
    const tests = suite.assertionResults ?? [];
    if (suite.status !== 'passed' || tests.length < minimum || tests.some(test => test.status !== 'passed')) {
      throw new Error(`${filename}: require at least ${minimum} cases, all passed; suite=${suite.status}, cases=${tests.length}, incomplete=${tests.filter(test => test.status !== 'passed').map(test => `${test.title}: ${test.status}`).join(', ')}`);
    }
    passed += tests.length;
  }
  if (report.success !== true) throw new Error('Vitest reported an unsuccessful run');
  return passed;
}

if (isMain(import.meta.url)) {
  try {
    const [filename, language] = process.argv.slice(2);
    if (!filename || !language) throw new Error('Usage: node scripts/check-host-e2e-report.mjs <vitest-report.json> <java|dotnet>');
    const passed = checkHostE2eReport(JSON.parse(readFileSync(filename, 'utf8')), language);
    console.log(`${language} host validation: ${passed} passed, 0 skipped`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

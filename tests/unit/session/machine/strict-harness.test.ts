/**
 * The test harness's half of strict mode (tests/vitest.setup.ts): a state
 * transition the table does not list fails the test, or the file, even when
 * the code under test swallowed the shadow's throw. Run on three fixtures in a
 * child Vitest process with their own minimal config
 * (tests/fixtures/state-shadow-harness), because the harness under test is the
 * one this process runs too. No network; about a second.
 */
import { describe, it, expect } from 'vitest';
import { execFile } from 'child_process';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures', 'state-shadow-harness');

interface JsonReport {
  success: boolean;
  testResults: Array<{
    name: string;
    status: string;
    message: string;
    assertionResults: Array<{ title: string; status: string; failureMessages: string[] }>;
  }>;
}

function runFixtures(): Promise<{ code: number | null; report: JsonReport; output: string }> {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'state-shadow-harness-'));
  const outputFile = path.join(dir, 'report.json');
  // The child is a test runner of its own: none of this worker's runner
  // variables, and no verdict log.
  const env: NodeJS.ProcessEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^VITEST/i.test(key) && key !== 'MCP_STATE_SHADOW_LOG')
  );
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs'), 'run', '--config', path.join(FIXTURES, 'vitest.config.ts'), '--reporter=json', `--outputFile=${outputFile}`],
      { cwd: ROOT, env, timeout: 90_000, windowsHide: true },
      (error, stdout, stderr) => {
        try {
          const report = JSON.parse(readFileSync(outputFile, 'utf8')) as JsonReport;
          const code = error && typeof (error as { code?: unknown }).code === 'number' ? (error as { code: number }).code : error ? 1 : 0;
          resolve({ code, report, output: `${stdout}\n${stderr}` });
        } catch (readError) {
          reject(new Error(`the child run left no report (${String(readError)}): ${stdout}\n${stderr}`));
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      }
    );
  });
}

describe('the strict-mode harness', () => {
  it('fails a test that swallowed an unlisted transition, and a file whose afterAll did, and passes one that claimed it', async () => {
    const { code, report, output } = await runFixtures();
    const byFile = Object.fromEntries(report.testResults.map((file) => [path.basename(file.name), file]));

    expect(code, output).not.toBe(0);
    expect(report.success).toBe(false);

    const inTest = byFile['swallowed-in-test.fixture.ts'];
    expect(inTest.status).toBe('failed');
    expect(inTest.assertionResults).toEqual([
      expect.objectContaining({ title: 'swallows an unlisted transition', status: 'failed' })
    ]);
    expect(inTest.assertionResults[0].failureMessages.join('\n')).toContain('[state-shadow] strict mode');
    expect(inTest.assertionResults[0].failureMessages.join('\n')).toContain('no-row at handleContinued');

    const afterAll = byFile['swallowed-after-all.fixture.ts'];
    expect(afterAll.status).toBe('failed');
    expect(afterAll.assertionResults.map((test) => test.status)).toEqual(['passed']);
    expect(afterAll.message).toContain('[state-shadow] strict mode, after the last test of the file');

    const drained = byFile['drained.fixture.ts'];
    expect(drained.status).toBe('passed');
  }, 120_000);
});

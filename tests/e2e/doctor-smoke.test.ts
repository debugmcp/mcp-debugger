/**
 * E2E smoke test for `mcp-debugger doctor` (issue #423).
 *
 * Runs the built CLI. Only mock's verdict is asserted — it needs no external
 * toolchain, so this test is deterministic on every machine and CI runner.
 * Real-toolchain verdicts (python, go, ...) are machine-dependent and are
 * deliberately not asserted.
 */
import { describe, it, expect } from 'vitest';
import { execFile } from 'child_process';
import { existsSync } from 'fs';
import * as path from 'path';

const projectRoot = process.cwd();
const distEntry = path.join(projectRoot, 'dist', 'index.js');

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runCli(args: string[], timeoutMs = 90_000): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [distEntry, ...args],
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error && typeof error.code !== 'number') {
          // Spawn failure or timeout, not a CLI exit code
          reject(error);
          return;
        }
        resolve({ code: error && typeof error.code === 'number' ? error.code : 0, stdout, stderr });
      }
    );
  });
}

describe('doctor e2e smoke', () => {
  it('emits a schemaVersion-1 JSON report covering all nine adapters, with mock ok', async () => {
    if (!existsSync(distEntry)) {
      throw new Error('dist/index.js not found. Run "npm run build" first.');
    }

    const result = await runCli(['doctor', 'mock', '--json']);

    expect(result.code).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.schemaVersion).toBe(1);
    expect(report.languages).toHaveLength(9);
    const mock = report.languages.find((l: { language: string }) => l.language === 'mock');
    expect(mock.verdict).toBe('ok');
    const ids = report.platformChecks.map((c: { id: string }) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['container-mode', 'workspace-mount', 'yama-ptrace-scope']));
  }, 120_000);

  it('exits 1 for an unknown requested language', async () => {
    if (!existsSync(distEntry)) {
      throw new Error('dist/index.js not found. Run "npm run build" first.');
    }

    const result = await runCli(['doctor', 'nosuchlang', '--json']);

    expect(result.code).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.unknownLanguages).toEqual(['nosuchlang']);
  }, 120_000);
});

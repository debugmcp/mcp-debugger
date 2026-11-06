/**
 * The shipped doctor command reads the CodeLLDB version from the resolved
 * engine's own root (issue #1066). Under a CODELLDB_PATH pointing into the
 * documented raw VSIX layout (<root>/extension/adapter/codelldb) that is the
 * extraction's `version.json` when there is one, else the VSIX's own
 * `package.json`; a binary with neither reports no version at all rather than
 * the CLI's compiled default.
 *
 * Runs the built CLI bundle from an isolated directory, so the checkout's
 * vendored engine cannot win the resolution, with every language but rust
 * disabled, so only the rust probe runs.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile, type ExecFileException } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { DebugLanguage } from '@debugmcp/shared';
import type { DoctorReport } from '../../../src/cli/commands/doctor/diagnose.js';
import { scrubbedEnvironment } from '../../test-utils/helpers/mcp-stdio-client.js';
import { requireCliBundle } from '../../test-utils/helpers/cli-bundle.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const run = promisify(execFile);
const vsixManifest = (version: string): string =>
  JSON.stringify({ name: 'vscode-lldb', publisher: 'vadimcn', version });

/**
 * The rust probe runs `cargo -vV`, which the canary has seen take over 30 s on
 * a cold Windows runner (its doctor step budgets 120 s): the doctor's default
 * 10 s probe budget would time the row out and lose the backend cell.
 */
const DOCTOR_TIMEOUT_MS = 60_000;
const CLI_KILL_MS = 90_000;
const CASE_TIMEOUT_MS = 120_000;

let fixtureRoot: string;
let cli: string;

beforeAll(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-codelldb-'));
  // One copy of the bundle: its own directory and cwd keep the checkout's
  // vendor tree out of the candidate walk.
  cli = path.join(fixtureRoot, 'cli.mjs');
  fs.copyFileSync(requireCliBundle(root), cli);
});

afterAll(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

/** A raw VSIX extraction: <root>/extension/adapter/codelldb plus the metadata the case wants. */
function extraction(versionJson: string | undefined, packageJson: string | undefined): string {
  const extensionRoot = path.join(fs.mkdtempSync(path.join(fixtureRoot, 'vsix-')), 'extension');
  fs.mkdirSync(path.join(extensionRoot, 'adapter'), { recursive: true });
  const executable = path.join(extensionRoot, 'adapter', process.platform === 'win32' ? 'codelldb.exe' : 'codelldb');
  // Version discovery checks existence and reads metadata; nothing executes the engine.
  fs.writeFileSync(executable, '');
  if (versionJson !== undefined) fs.writeFileSync(path.join(extensionRoot, 'version.json'), versionJson);
  if (packageJson !== undefined) fs.writeFileSync(path.join(extensionRoot, 'package.json'), packageJson);
  return executable;
}

async function doctorRust(executable: string, command = cli, killAfterMs = CLI_KILL_MS): Promise<DoctorReport> {
  const { stdout } = await run(
    process.execPath,
    [command, 'doctor', 'rust', '--json', '--timeout', String(DOCTOR_TIMEOUT_MS)],
    {
      cwd: fixtureRoot,
      env: {
        ...scrubbedEnvironment(),
        CODELLDB_PATH: executable,
        // Only the rust probe runs: the other toolchains are neither needed nor waited on.
        DEBUG_MCP_DISABLE_LANGUAGES: Object.values(DebugLanguage)
          .filter((language) => language !== DebugLanguage.RUST)
          .join(',')
      },
      timeout: killAfterMs,
      windowsHide: true
    }
  ).catch((error: ExecFileException & { stdout: string; stderr: string }) => {
    throw new Error([
      error.message,
      `exit code: ${error.code}`,
      `signal: ${error.signal}`,
      `killed: ${error.killed}`,
      `stdout:\n${error.stdout || '(empty)'}`,
      `stderr:\n${error.stderr || '(empty)'}`
    ].join('\n'), { cause: error });
  });
  return JSON.parse(stdout) as DoctorReport;
}

function rustBackend(report: DoctorReport): unknown {
  return report.languages.find((language) => language.language === 'rust')?.backend;
}

describe('doctor CodeLLDB version under CODELLDB_PATH (issue #1066)', () => {
  it.each([
    {
      name: 'reads the raw VSIX manifest',
      versionJson: undefined,
      packageJson: vsixManifest('1.11.8'),
      expected: '1.11.8'
    },
    {
      name: 'prefers version.json',
      versionJson: '{"version":"1.11.7"}',
      packageJson: vsixManifest('1.11.8'),
      expected: '1.11.7'
    },
    {
      name: 'falls through to the manifest when version.json has no version field',
      versionJson: '{}',
      packageJson: vsixManifest('1.11.8'),
      expected: '1.11.8'
    }
  ])('$name', async ({ versionJson, packageJson, expected }) => {
    const executable = extraction(versionJson, packageJson);
    const report = await doctorRust(executable);

    expect(report.exitCode).toBe(0);
    expect(report.requested).toEqual(['rust']);
    expect(rustBackend(report)).toEqual({
      label: 'CodeLLDB', path: executable, version: expected, source: 'env:CODELLDB_PATH'
    });
  }, CASE_TIMEOUT_MS);

  it("reports no version for a binary whose only neighbour is someone else's package.json", async () => {
    const executable = extraction(undefined, '{"name":"my-app","version":"0.4.2"}');
    const report = await doctorRust(executable);

    expect(report.exitCode).toBe(0);
    // No version key at all — not the compiled default, not my-app's 0.4.2.
    expect(rustBackend(report)).toEqual({
      label: 'CodeLLDB', path: executable, source: 'env:CODELLDB_PATH'
    });
  }, CASE_TIMEOUT_MS);
});

describe('doctor subprocess failure diagnostics (issue #1098)', () => {
  it.each([
    { name: 'JSON stdout and stderr', stdout: '{"exitCode":0}', stderr: 'toolchain diagnostic' },
    { name: 'empty output', stdout: '', stderr: '' }
  ])('reports the exit status and $name', async ({ stdout, stderr }) => {
    const command = path.join(fixtureRoot, 'exit-failure.mjs');
    fs.writeFileSync(command, [
      `process.stdout.write(${JSON.stringify(stdout)});`,
      `process.stderr.write(${JSON.stringify(stderr)});`,
      'process.exitCode = 17;'
    ].join('\n'));

    const failure = doctorRust('', command);
    await expect(failure).rejects.toThrow('exit code: 17');
    await expect(failure).rejects.toThrow('signal: null');
    await expect(failure).rejects.toThrow('killed: false');
    await expect(failure).rejects.toThrow(`stdout:\n${stdout || '(empty)'}`);
    await expect(failure).rejects.toThrow(`stderr:\n${stderr || '(empty)'}`);
  });

  it('reports a parent kill separately from a nonzero exit', async () => {
    const command = path.join(fixtureRoot, 'wait-for-kill.mjs');
    fs.writeFileSync(command, 'setInterval(() => {}, 1000);');

    const failure = doctorRust('', command, 100);
    await expect(failure).rejects.toThrow('exit code: null');
    await expect(failure).rejects.toThrow('signal: SIGTERM');
    await expect(failure).rejects.toThrow('killed: true');
    await expect(failure).rejects.toThrow('stdout:\n(empty)');
    await expect(failure).rejects.toThrow('stderr:\n(empty)');
  });
});

/** Exercise the shipped doctor command with the documented raw VSIX layout (#1066). */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { DebugLanguage } from '@debugmcp/shared';
import { DEFAULT_CODELLDB_VERSION } from '@debugmcp/codelldb-common';
import type { DoctorReport } from '../../../src/cli/commands/doctor/diagnose.js';
import { scrubbedEnvironment } from '../../test-utils/helpers/mcp-stdio-client.js';
import { requireCliBundle } from '../../test-utils/helpers/cli-bundle.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const run = promisify(execFile);
let fixtureRoot: string;
let extensionRoot: string;
let executable: string;

beforeEach(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-codelldb-'));
  // An isolated install and cwd prevent the checkout's vendored engine from winning.
  fs.copyFileSync(requireCliBundle(root), path.join(fixtureRoot, 'cli.mjs'));
  extensionRoot = path.join(fixtureRoot, 'extension');
  fs.mkdirSync(path.join(extensionRoot, 'adapter'), { recursive: true });
  executable = path.join(extensionRoot, 'adapter', process.platform === 'win32' ? 'codelldb.exe' : 'codelldb');
  // Version discovery checks existence and reads metadata without executing CodeLLDB.
  fs.writeFileSync(executable, '');
});

afterEach(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

describe('doctor CodeLLDB version', () => {
  it.each([
    {
      name: 'reads the raw VSIX manifest',
      versionJson: undefined,
      packageJson: '{"version":"1.11.8"}',
      expected: '1.11.8'
    },
    {
      name: 'prefers version.json',
      versionJson: '{"version":"1.11.7"}',
      packageJson: '{"version":"1.11.8"}',
      expected: '1.11.7'
    },
    {
      name: 'preserves an empty version.json fallback',
      versionJson: '{}',
      packageJson: '{"version":"1.11.8"}',
      expected: DEFAULT_CODELLDB_VERSION
    }
  ])('$name', async ({ versionJson, packageJson, expected }) => {
    if (versionJson !== undefined) fs.writeFileSync(path.join(extensionRoot, 'version.json'), versionJson);
    fs.writeFileSync(path.join(extensionRoot, 'package.json'), packageJson);
    const { stdout, stderr } = await run(process.execPath, [path.join(fixtureRoot, 'cli.mjs'), 'doctor', 'rust', '--json'], {
      cwd: fixtureRoot,
      env: {
        ...scrubbedEnvironment(),
        CODELLDB_PATH: executable,
        // Keep this metadata test independent of other installed language toolchains.
        DEBUG_MCP_DISABLE_LANGUAGES: Object.values(DebugLanguage).filter(language => language !== DebugLanguage.RUST).join(',')
      },
      timeout: 15_000,
      windowsHide: true
    });

    expect(stderr).toBe('');
    const report = JSON.parse(stdout) as DoctorReport;
    expect(report.exitCode).toBe(0);
    expect(report.requested).toEqual(['rust']);
    expect(report.languages.find(language => language.language === 'rust')?.backend).toEqual({
      label: 'CodeLLDB', path: executable, version: expected, source: 'env:CODELLDB_PATH'
    });
  });
});

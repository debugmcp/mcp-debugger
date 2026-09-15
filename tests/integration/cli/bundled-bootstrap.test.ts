import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { requireCliBundle } from '../../test-utils/helpers/cli-bundle.js';

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const preload = new URL('../../fixtures/cli/report-bootstrap-env.mjs', import.meta.url).href;

describe('bundled CLI bootstrap environment (issue #717)', () => {
  // The three branches that differ: absent (deleted on restore), the value the
  // bootstrap itself sets (so restoring it is not a no-op), and anything else.
  it.each([undefined, '1', 'custom'])('restores the inherited value %j before invoking main()', async (value) => {
    // Filter rather than `delete env.DEBUG_MCP_SKIP_AUTO_START`: `process.env`
    // is case-insensitive on Windows but the spread copy is not, so a
    // differently-cased inherited key would survive the delete and be passed on.
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'DEBUG_MCP_SKIP_AUTO_START')
    );
    if (value !== undefined) env.DEBUG_MCP_SKIP_AUTO_START = value;

    const cli = requireCliBundle(root);
    const { stdout, stderr } = await execFileAsync(process.execPath, ['--import', preload, cli, '--version'], {
      env,
      windowsHide: true,
      timeout: 10000,
    });
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
    const report = stderr.split('\n').find(line => line.startsWith('bootstrap-env:'));
    expect(report).toBeDefined();
    expect(JSON.parse(report!.slice('bootstrap-env:'.length))).toEqual(
      value === undefined ? {} : { skipAutoStart: value }
    );
  });
});

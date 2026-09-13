import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const cli = fileURLToPath(new URL('../../../packages/mcp-debugger/dist/cli.mjs', import.meta.url));
const preload = new URL('../../fixtures/cli/report-bootstrap-env.mjs', import.meta.url).href;

describe('bundled CLI bootstrap environment (issue #717)', () => {
  it.each([undefined, '', '0', '1', 'custom'])('restores the inherited value %j before invoking main()', async (value) => {
    const env = { ...process.env };
    if (value === undefined) delete env.DEBUG_MCP_SKIP_AUTO_START;
    else env.DEBUG_MCP_SKIP_AUTO_START = value;
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

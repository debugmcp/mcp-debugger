/**
 * Docker Entrypoint Regression Test
 *
 * Verifies that the Docker entrypoint correctly passes CLI arguments.
 * This test catches the quoting bug where printf-generated entry.sh
 * produced literal \" characters, breaking SSE mode argument passing.
 *
 * The test should FAIL before the fix (entry.sh has \"$@\") and PASS after
 * (entry.sh has "$@").
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { buildDockerImage } from './docker-test-utils.js';

const execAsync = promisify(exec);

const SKIP_DOCKER = process.env.SKIP_DOCKER_TESTS === 'true';
const IMAGE_NAME = process.env.DOCKER_IMAGE_NAME || 'mcp-debugger:local';

describe.skipIf(SKIP_DOCKER)('Docker: Entrypoint Argument Passing', () => {
  beforeAll(async () => {
    await buildDockerImage({ imageName: IMAGE_NAME });
  }, 240000);

  it('should pass --version without argument corruption', async () => {
    // --version should work cleanly. With the quoting bug, it would produce
    // error: unknown option '--version"' (note trailing literal quote)
    const { stdout, stderr } = await execAsync(
      `docker run --rm ${IMAGE_NAME} --version`,
      { timeout: 30000 }
    );
    const output = (stdout + stderr).trim();

    // Should contain a version string, not an error about unknown options
    expect(output).not.toContain('unknown option');
    expect(output).not.toContain('error:');
    // Version output should be a semver-like string
    expect(output).toMatch(/\d+\.\d+/);
  }, 60000);

  it('should pass sse --help without argument corruption', async () => {
    // With the quoting bug: \"sse\" is passed as the command name,
    // Commander can't match it to the 'sse' subcommand, falls through to
    // default 'stdio', and --help gets the trailing quote: '--help"'
    const { stdout, stderr } = await execAsync(
      `docker run --rm ${IMAGE_NAME} sse --help`,
      { timeout: 30000 }
    );
    const output = (stdout + stderr).trim();

    // Should show SSE subcommand help, not an error
    expect(output).not.toContain('unknown option');
    expect(output).toContain('-p');  // --port option should be listed
    expect(output).toContain('sse');
  }, 60000);

  it('should start SSE mode with -p argument', async () => {
    const containerName = `mcp-entrypoint-test-${Date.now()}`;

    try {
      // Start in SSE mode with a specific port
      await execAsync(
        `docker run -d --name ${containerName} -p 0:3001 ${IMAGE_NAME} sse -p 3001`,
        { timeout: 30000 }
      );

      // Give the server a moment to start (or fail)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if container is still running (it would exit immediately with the bug)
      const { stdout: status } = await execAsync(
        `docker inspect --format="{{.State.Running}}" ${containerName}`,
        { timeout: 10000 }
      );

      expect(status.trim()).toBe('true');

      // Check logs don't contain the quoting error
      const { stdout: logs, stderr: logErr } = await execAsync(
        `docker logs ${containerName} 2>&1`,
        { timeout: 10000 }
      );
      const allLogs = logs + logErr;
      expect(allLogs).not.toContain('unknown option');
      expect(allLogs).not.toContain("error: unknown option '-p'");
    } finally {
      // Cleanup
      try { await execAsync(`docker stop ${containerName}`, { timeout: 10000 }); } catch { /* ignore */ }
      try { await execAsync(`docker rm ${containerName}`, { timeout: 5000 }); } catch { /* ignore */ }
    }
  }, 60000);
});

/**
 * Guard the mechanism #717's fix rests on: esbuild emits a lazy `init_src()`
 * for cli-entry's dynamic `import('../../../src/index.js')`. Turn that into a
 * static import and it hoists — `src/index.ts` auto-runs `main()` at module
 * load AND `bootstrap()` calls `entrypoint.main()` — leaving two servers on one
 * stdin, each answering every request.
 *
 * `bundled-bootstrap.test.ts` cannot see that: `--version` exits inside the
 * first `main()`. The e2e project that would notice is not run by CI, so the
 * check lives here. Structural fix tracked in issue #732.
 */
import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { requireCliBundle } from '../../test-utils/helpers/cli-bundle.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));

describe('bundled CLI entrypoint (issue #717)', () => {
  it('answers a single initialize request exactly once', async () => {
    // Filtered, not deleted: `process.env` is case-insensitive on Windows while
    // the copy is not. The regression only doubles main() when this is unset —
    // with "1" inherited, the hoisted module would suppress its own auto-start.
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'DEBUG_MCP_SKIP_AUTO_START')
    );

    const child = spawn(process.execPath, [requireCliBundle(root), 'stdio'], {
      cwd: root,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    try {
      child.stderr.resume();
      const frames: Array<{ id?: unknown }> = [];
      let buffer = '';
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            frames.push(JSON.parse(line) as { id?: unknown });
          } catch {
            // Not a JSON-RPC frame; stdout is supposed to carry nothing else.
          }
        }
      });

      child.stdin.write(`${JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'single-entrypoint-test', version: '1.0.0' },
        },
      })}\n`);

      const answers = () => frames.filter(frame => frame.id === 1).length;
      await expect.poll(answers, { timeout: 20000 }).toBe(1);
      // Give a second server time to answer the same id.
      await delay(2000);
      expect(answers(), `ids on stdout: ${JSON.stringify(frames.map(frame => frame.id))}`).toBe(1);
    } finally {
      child.kill();
    }
  }, 30000);
});

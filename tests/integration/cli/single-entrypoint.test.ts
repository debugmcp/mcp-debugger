/**
 * One `main()` per process, whichever entry starts it (issues #717, #732).
 *
 * The bundled CLI (`cli-entry.ts`) must never import `src/index.ts`: inside the
 * bundle every module shares `import.meta.url`, so index.ts's main-module check
 * is true for a `node cli.mjs` launch and it would auto-run `main()` on import
 * while the bootstrap runs it again — two servers on one stdin, each answering
 * every request. Until #732 that was held off by the `DEBUG_MCP_SKIP_AUTO_START`
 * flag the bootstrap set around a dynamic import; now `cli-entry.ts` imports
 * `src/main.ts` directly and the flag does not exist. The second case pins the
 * other half: an inherited value of the old flag no longer silences
 * `dist/index.js` (the e2e self-debug used to scrub it for exactly that).
 *
 * The e2e project that would notice either is not run by CI, so the checks live
 * here.
 */
import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { requireCliBundle, requireDistEntry } from '../../test-utils/helpers/cli-bundle.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * Start `<entry> stdio`, send one `initialize`, and count the frames that
 * answer it after a settling delay.
 */
async function initializeAnswers(entry: string, env: NodeJS.ProcessEnv): Promise<{ answers: number; ids: unknown[] }> {
  const child = spawn(process.execPath, [entry, 'stdio'], {
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
    await expect.poll(answers, { timeout: 20000 }).toBeGreaterThanOrEqual(1);
    // Give a second server time to answer the same id.
    await delay(2000);
    return { answers: answers(), ids: frames.map(frame => frame.id) };
  } finally {
    child.kill();
  }
}

/** The runner's environment without the old flag, compared upper-cased (Windows env is case-insensitive, the copy is not). */
function environmentWithout(key: string): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => name.toUpperCase() !== key.toUpperCase())
  );
}

describe('one main() per process (issues #717, #732)', () => {
  it('the bundled CLI answers a single initialize request exactly once', async () => {
    const { answers, ids } = await initializeAnswers(requireCliBundle(root), environmentWithout('DEBUG_MCP_SKIP_AUTO_START'));
    expect(answers, `ids on stdout: ${JSON.stringify(ids)}`).toBe(1);
  }, 30000);

  it('dist/index.js starts its server even with DEBUG_MCP_SKIP_AUTO_START=1 inherited (the flag is gone)', async () => {
    const env = { ...environmentWithout('DEBUG_MCP_SKIP_AUTO_START'), DEBUG_MCP_SKIP_AUTO_START: '1' };
    const { answers, ids } = await initializeAnswers(requireDistEntry(root), env);
    expect(answers, `ids on stdout: ${JSON.stringify(ids)}`).toBe(1);
  }, 30000);
});

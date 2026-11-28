/**
 * Issue #1320: against a real `python -m debugpy --listen` target and the built
 * MCP server (`dist/index.js stdio`), attaching with a mismatched
 * `adapterConfig.pathMappings` makes `set_breakpoint` answer `verified: false`
 * with debugpy's `"Breakpoint in file that does not exist."` first in `message`
 * and `warning`, followed by the target-path and `pathMappings` guidance in
 * `warning`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStdioClient, type StdioClientHandle, type ToolAnswer } from '../../../test-utils/helpers/mcp-stdio-client.js';
import { ensurePythonOnPath } from './env-utils.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');
const attachLoopScript = path.join(repoRoot, 'examples', 'python', 'attach_loop.py');
const PYTHON =
  process.env.PYTHON_PATH ?? process.env.PYTHON_EXECUTABLE ?? (process.platform === 'win32' ? 'python' : 'python3');

type SetBreakpointAnswer = ToolAnswer & {
  breakpointId?: string;
  file?: string;
  line?: number;
  requestedLine?: number;
  content?: string;
  verified?: boolean;
  context?: unknown;
};

async function findFreeLoopbackPort(): Promise<number> {
  for (let candidate = 5910; candidate <= 5959; candidate++) {
    const available = await new Promise<boolean>((resolve) => {
      const probe = net.createServer();
      probe.once('error', () => resolve(false));
      probe.listen(candidate, '127.0.0.1', () => {
        probe.close(() => resolve(true));
      });
    });
    if (available) {
      return candidate;
    }
  }
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const addr = probe.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      probe.close(() => (port ? resolve(port) : reject(new Error('no free port'))));
    });
  });
}

async function startDebugpyTarget(): Promise<{ proc: ChildProcess; port: number; stop: () => Promise<void> }> {
  const port = await findFreeLoopbackPort();
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v;
  }
  ensurePythonOnPath(env);

  const proc = spawn(PYTHON, ['-m', 'debugpy', '--listen', `127.0.0.1:${port}`, attachLoopScript], {
    cwd: repoRoot,
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  const closed = new Promise<void>((resolve) => proc.once('close', () => resolve()));

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`debugpy target did not become ready: ${output}`)), 20_000);
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      if (output.includes('ATTACH_LOOP_READY')) {
        clearTimeout(timer);
        resolve();
      }
    };
    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);
    proc.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`debugpy target exited (${code}) before ready: ${output}`));
    });
  });

  return {
    proc,
    port,
    stop: async () => {
      if (proc.exitCode === null && !proc.killed) {
        proc.kill();
      }
      await Promise.race([closed, new Promise<void>((resolve) => setTimeout(resolve, 3_000))]);
    }
  };
}

describe('Python attach unbound breakpoint hint against live debugpy (issue #1320)', () => {
  let server: StdioClientHandle | undefined;
  let target: Awaited<ReturnType<typeof startDebugpyTarget>> | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
    await target?.stop();
    target = undefined;
  });

  it('appends pathMappings and target-path guidance after debugpy missing-file sentence', async () => {
    target = await startDebugpyTarget();
    const env: Record<string, string> = {};
    ensurePythonOnPath(env);
    server = await startStdioClient({ name: 'python-attach-unbound-breakpoint', env });
    await server.createSession('python', 'python-attach-unbound');

    const attachAnswer = await server.call('attach_to_process', {
      host: '127.0.0.1',
      port: target.port,
      stopOnEntry: false,
      adapterConfig: {
        pathMappings: [{ localRoot: repoRoot, remoteRoot: '/wrong/remote/root' }]
      }
    });
    expect(attachAnswer.success, JSON.stringify(attachAnswer)).toBe(true);

    const bpAnswer = await server.call<SetBreakpointAnswer>('set_breakpoint', {
      file: attachLoopScript,
      line: 7
    });

    expect(bpAnswer.success).toBe(true);
    expect(bpAnswer.verified).toBe(false);
    expect(bpAnswer.message).toBe('Breakpoint in file that does not exist.');
    expect(bpAnswer.warning).toBe(
      "Breakpoint in file that does not exist.; debugpy looked for this path, after any adapterConfig.pathMappings, on the target's file system. " +
        'If the target runs in a container or on another machine, attach with a pathMappings entry whose ' +
        'localRoot contains this file and whose remoteRoot is the same directory on the target, or set the ' +
        "breakpoint by the target's own path when no pathMappings entry rewrites it."
    );
  }, 60_000);
});

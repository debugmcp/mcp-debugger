/**
 * The Dart and .NET bridges end their adapter when the worker's socket goes
 * away. On Windows `cp.kill()` is TerminateProcess on the direct child alone,
 * and the adapter is never alone (`dart.exe` → `dartvm.exe` → flutter.bat →
 * … → the app; netcoredbg → the debuggee): everything below the child was
 * re-parented and kept running (issue #937). Real processes: the bridge's
 * child is a node that spawns a grandchild, both tagged in argv so the
 * process table can find them; the socket is destroyed; the table decides.
 *
 * On POSIX the bridge alone is not expected to reach the grandchild — the
 * proxy's process-group kill covers that, and there is no proxy here — so
 * only the direct child is asserted gone there.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import { createBridge as createDartBridge } from '../../packages/adapter-dart/src/bridge/dap-stdio-bridge-core.js';
import { createBridge as createDotnetBridge } from '../../packages/adapter-dotnet/src/utils/netcoredbg-bridge-core.js';
import {
  killProcesses,
  listProcessesByImage,
  waitForProcessesToExit
} from '../test-utils/helpers/process-table.js';

const isWindows = process.platform === 'win32';

/**
 * A child that spawns one grandchild and idles; both carry `marker` in argv.
 * The grandchild is `detached`: a Node parent otherwise puts its children in a
 * libuv job object that dies with it, which the real tool chains (dart.exe,
 * netcoredbg) do not have — detached is what models a tool's own subprocess.
 */
function childProgram(marker: string): string[] {
  const code = [
    "const { spawn } = require('child_process');",
    `spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', '${marker}-grandchild'], { stdio: 'ignore', windowsHide: true, detached: true }).unref();`,
    'setInterval(() => {}, 1000);'
  ].join(' ');
  return ['-e', code, `${marker}-child`];
}

/** Pids of the node processes whose argv carries `tag`, once the table lists them. */
async function waitForTagged(tag: string, timeoutMs: number): Promise<number[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    // Exact tokens: the child's `-e` program text names the grandchild's tag too.
    const pids = (await listProcessesByImage('node'))
      .filter((proc) => proc.args.some((arg) => arg === tag))
      .map((proc) => proc.pid);
    if (pids.length > 0 || Date.now() >= deadline) return pids;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

const MARKER_PREFIX = `bridge-937-${process.pid}-`;

/**
 * Whatever this file started and is still running, found by its marker — never
 * by a remembered pid, which a verified-dead process may have handed to a
 * stranger by now (the POSIX grandchild is expected to outlive the bridge's
 * plain kill, and a failed assertion can leave either process behind).
 */
afterEach(async () => {
  const mine = (await listProcessesByImage('node'))
    .filter((proc) => proc.args.some((arg) => arg.startsWith(MARKER_PREFIX)))
    .map((proc) => proc.pid);
  await killProcesses(mine);
});

async function assertTreeEnded(marker: string, tree: { child: number[]; grandchild: number[] }): Promise<void> {
  const expected = isWindows ? [...tree.child, ...tree.grandchild] : tree.child;
  const survivors = await waitForProcessesToExit(expected, { timeoutMs: 5000, image: 'node' });
  expect(survivors, `survivors of ${marker}`).toEqual([]);
}

async function findTree(marker: string): Promise<{ child: number[]; grandchild: number[] }> {
  const child = await waitForTagged(`${marker}-child`, 15_000);
  const grandchild = await waitForTagged(`${marker}-grandchild`, 15_000);
  expect(child, 'the bridge child in the process table').toHaveLength(1);
  expect(grandchild, 'its grandchild in the process table').toHaveLength(1);
  return { child, grandchild };
}

describe('bridge socket-gone ends the adapter tree, not just the direct child (issue #937)', () => {
  it('dart bridge', async () => {
    const marker = `${MARKER_PREFIX}dart-${Date.now()}`;
    const bridge = await createDartBridge({
      port: 0,
      host: '127.0.0.1',
      command: process.execPath,
      args: childProgram(marker),
      stderr: new PassThrough()
    });
    try {
      const socket = net.connect({ host: '127.0.0.1', port: bridge.port });
      await once(socket, 'connect');
      const tree = await findTree(marker);

      socket.destroy();

      await assertTreeEnded(marker, tree);
      await expect.poll(() => bridge.exitCode, { timeout: 5000 }).toBeDefined();
    } finally {
      await bridge.close();
    }
  }, 60_000);

  it('netcoredbg bridge', async () => {
    const marker = `${MARKER_PREFIX}dotnet-${Date.now()}`;
    // The bridge spawns `<netcoredbg> --interpreter=vscode`; the injected spawn
    // runs the tagged node program instead, through the real child_process.
    const spawnFn = (_cmd: string, _args: string[], opts: SpawnOptions): ChildProcess =>
      spawn(process.execPath, childProgram(marker), { ...opts, windowsHide: true });
    const bridge = createDotnetBridge('netcoredbg', 0, { spawnFn, stderr: new PassThrough() });
    try {
      await once(bridge.server, 'listening');
      const { port } = bridge.server.address() as net.AddressInfo;
      const socket = net.connect({ host: '127.0.0.1', port });
      await once(socket, 'connect');
      const tree = await findTree(marker);

      socket.destroy();

      await assertTreeEnded(marker, tree);
    } finally {
      bridge.cleanup();
    }
  }, 60_000);
});

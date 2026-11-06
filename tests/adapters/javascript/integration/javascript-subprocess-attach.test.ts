/**
 * The session tree over a by-port attach with real js-debug (issue #1082): a
 * target started with `node --inspect` that forks a Node child after the
 * attach. `autoAttachChildProcesses` is on by default for attach as for
 * launch, so no case names the key except the one that opts out: js-debug
 * injects its bootloader into the attached process and reports every process
 * it forks from then on, and the server adopts each as a child session.
 *
 * Measured during #1094's review (js-debug v1.140.0): under an attach root the
 * children's console output arrives on their own connections — a child's
 * `get_output` carries its own lines and no `outputOn` pointer (an attach does
 * not own the process pipes the way a launch does). The cascades on an attach
 * root release its targets: detach keeps the rows, close removes them, and the
 * target runs to its end either way. The last case is #501's wedge guard on
 * the fork target the e2e attach smoke uses, here so CI runs it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import net from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startStdioClient, type StdioClientHandle, type ToolAnswer } from '../../../test-utils/helpers/mcp-stdio-client.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const treeDir = path.join(root, 'tests/fixtures/javascript/subprocess-tree');
const attachParent = path.join(treeDir, 'attach_parent.js');
const childFixture = path.join(treeDir, 'child.js');
const forkTarget = path.join(root, 'examples/javascript/fork_attach_target.js');
/** `total += i; // BREAKPOINT` in child.js. */
const CHILD_BREAKPOINT_LINE = 14;

interface Row { id: string; name: string; state: string; parentSessionId?: string }
interface ChildSummary { sessionId: string; name: string; state: string; parentSessionId: string }
interface Stop extends ToolAnswer {
  sessionId?: string;
  pending?: boolean;
  exitCode?: number;
  location?: { file: string; line: number };
  lastStop?: { line?: number };
  children?: ChildSummary[];
  childrenClosed?: number;
  childrenReleased?: number;
  released?: boolean;
  warning?: string;
}
interface Closed extends ToolAnswer { childrenClosed?: number; processEnded?: boolean; released?: boolean }
interface Output extends ToolAnswer { entries: Array<{ output: string }>; outputOn?: string; note?: string }
interface Stack extends ToolAnswer { stackFrames: Array<{ id: number; file?: string; line?: number }> }

interface Target {
  proc: ChildProcess;
  port: number;
  output: () => string;
  exited: Promise<number | null>;
  /**
   * Tell attach_parent.js to fork its child (one line on stdin): `go` once
   * js-debug's bootloader is in the target's environment, which happens a
   * moment after the attach answers (measured; a fork inside that window
   * runs unreported), `now` at once (an attach that opted out injects nothing).
   */
  go: (mode?: 'go' | 'now') => void;
}

let server: StdioClientHandle;
let targets: Target[] = [];
const call = <T extends ToolAnswer = ToolAnswer>(name: string, args: Record<string, unknown> = {}): Promise<T> => server.call<T>(name, args);
const rows = async (): Promise<Row[]> => (await call<ToolAnswer & { sessions: Row[] }>('list_debug_sessions')).sessions;
const outputOf = (sessionId: string): Promise<Output> => call<Output>('get_output', { sessionId, limit: 1000 });
const outputText = async (sessionId: string): Promise<string> => (await outputOf(sessionId)).entries.map((e) => e.output).join('');
const lineOf = (stop: Stop): number | undefined => stop.location?.line ?? stop.lastStop?.line;
const fileOf = (stop: Stop): string => stop.location?.file ?? '';

async function pollUntil<T>(read: () => Promise<T>, accept: (value: T) => boolean, timeoutMs: number, intervalMs = 250): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last = await read();
  while (!accept(last) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    last = await read();
  }
  return last;
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => (port ? resolve(port) : reject(new Error('no free port'))));
    });
    probe.on('error', reject);
  });
}

/** Start a script under `node --inspect` and wait until its inspector listens. */
async function startTarget(script: string): Promise<Target> {
  const port = await getFreePort();
  const proc = spawn(process.execPath, [`--inspect=127.0.0.1:${port}`, script], {
    cwd: treeDir,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  let buffer = '';
  // close also waits for the output pipes, so the exit assertions see the final lines.
  const exited = new Promise<number | null>((resolve) => proc.on('close', (code) => resolve(code)));
  const target: Target = { proc, port, output: () => buffer, exited, go: (mode = 'go') => { proc.stdin!.write(`${mode}\n`); } };
  // Register before readiness so afterEach also cleans up a failed startup.
  targets.push(target);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`node --inspect not listening: ${buffer}`)), 30000);
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      if (buffer.includes('Debugger listening on')) { clearTimeout(timer); resolve(); }
    };
    proc.stdout!.on('data', onData);
    proc.stderr!.on('data', onData);
    proc.on('error', (error) => { clearTimeout(timer); reject(error); });
    proc.on('exit', (code) => { clearTimeout(timer); reject(new Error(`target exited ${code} before listening: ${buffer}`)); });
  });
  return target;
}

/** The target's exit, with its own pipes' last lines: the proof that nothing killed it. */
async function targetRanToItsEnd(target: Target): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const exit = await Promise.race([target.exited, new Promise<string>((resolve) => {
      timer = setTimeout(() => resolve('still running'), 20000);
    })]);
    expect(exit, target.output()).toBe(0);
    expect(target.output()).toContain('child done 3');
    expect(target.output()).toContain('parent child exit 0');
  } finally {
    clearTimeout(timer);
  }
}

/** Create the root, set the child's breakpoint before the attach, attach without stopping. */
async function attachRoot(name: string, target: Target, extra: Record<string, unknown> = {}): Promise<{ rootId: string; attached: Stop }> {
  const rootId = await server.createSession('javascript', name);
  const bp = await call('set_breakpoint', { file: childFixture, line: CHILD_BREAKPOINT_LINE });
  expect(bp.success, JSON.stringify(bp)).toBe(true);
  const attached = await call<Stop>('attach_to_process', { host: '127.0.0.1', port: target.port, stopOnEntry: false, verifyTimeout: 20000, ...extra });
  expect(attached.success, JSON.stringify(attached)).toBe(true);
  expect(attached.state, JSON.stringify(attached)).toBe('running');
  return { rootId, attached };
}

/**
 * Wait on `sessionId` for a stop that must be a paused child of the tree at
 * `line`, and hand back its id. Under load js-debug can surface an adopted
 * child's first statement as a `pause` stop before its breakpoint (measured
 * once in the pre-push hook with four cluster workers starting at once:
 * reason 'pause', "Paused on debugger statement", at the module's first
 * line, which the js policy reports as a breakpoint); that stop is js-debug's
 * entry pause, not the tree's doing, so it is resumed and the wait repeated.
 */
async function waitForChildStop(sessionId: string, file: RegExp, line: number): Promise<Stop & { sessionId: string }> {
  for (let entryPauses = 0; ; entryPauses += 1) {
    const stop = await call<Stop>('wait_for_stop', { sessionId, timeout: 30000 });
    expect(stop.state, JSON.stringify(stop)).toBe('paused');
    expect(stop.sessionId, JSON.stringify(stop)).toBeDefined();
    expect(stop.sessionId).not.toBe(sessionId);
    expect(fileOf(stop), JSON.stringify(stop)).toMatch(file);
    if (lineOf(stop) === line || entryPauses >= 2) {
      expect(lineOf(stop), JSON.stringify(stop)).toBe(line);
      return stop as Stop & { sessionId: string };
    }
    const resumed = await call('continue_execution', { sessionId: stop.sessionId });
    expect(resumed.success, JSON.stringify(resumed)).toBe(true);
  }
}

beforeEach(async () => {
  server = await startStdioClient({ name: 'js-subprocess-attach', callTimeoutMs: 60_000 });
});

afterEach(async () => {
  await server?.close();
  for (const target of targets) {
    if (target.proc.exitCode === null) target.proc.kill();
  }
  targets = [];
}, 30_000);

describe('JavaScript session tree over a by-port attach (issue #1082)', () => {
  it('a fork started after the attach stops on the breakpoint set before it, keeps its own output, and the root ends when the target does', async () => {
    const target = await startTarget(attachParent);
    const { rootId, attached } = await attachRoot('js-attach-tree-designed-flow', target);
    // Nothing was passed for the key, so nothing can be warned about; the default is the server's.
    expect(String(attached.warning ?? '')).not.toContain('autoAttachChildProcesses');
    target.go();

    let childId: string | undefined;
    for (let iteration = 0; iteration < 3; iteration += 1) {
      const stop = await waitForChildStop(rootId, /child\.js$/, CHILD_BREAKPOINT_LINE);
      childId ??= stop.sessionId;
      expect(stop.sessionId).toBe(childId);
      expect(stop.children, JSON.stringify(stop)).toEqual([
        { sessionId: childId, name: expect.stringMatching(/child\.js \[\d+\]$/), state: 'paused', parentSessionId: rootId }
      ]);
      if (iteration === 0) {
        const stack = await call<Stack>('get_stack_trace', { sessionId: childId });
        expect(stack.success, JSON.stringify(stack)).toBe(true);
        expect(stack.stackFrames[0]?.line).toBe(CHILD_BREAKPOINT_LINE);
      }
      const resumed = await call('continue_execution', { sessionId: childId });
      expect(resumed.success, JSON.stringify(resumed)).toBe(true);
    }

    // Under an attach root the child's console lines arrive on its own
    // connection (measured): its own buffer has them and there is no pointer.
    const childOutput = await pollUntil(() => outputOf(childId!), (answer) => answer.entries.some((e) => e.output.includes('child start')), 10000);
    expect(childOutput.entries.map((e) => e.output).join(''), JSON.stringify(childOutput)).toContain('child start');
    expect(childOutput.outputOn).toBeUndefined();

    // An attach root ends with `terminated` and no exit code, like its child.
    const ended = await call<Stop>('wait_for_stop', { sessionId: rootId, timeout: 30000 });
    expect(ended.state, JSON.stringify(ended)).toBe('stopped');
    expect(ended.sessionId).toBe(rootId);
    expect(ended.exitCode).toBeUndefined();
    expect(ended.children).toEqual([expect.objectContaining({ sessionId: childId, state: 'stopped', parentSessionId: rootId })]);
    expect(target.output(), 'the fixture forked once the bootloader was in its environment').toContain('parent go (bootloader injected)');
    await targetRanToItsEnd(target);
  }, 120_000);

  it('detaching the attach root releases the paused fork first and keeps both rows stopped; the target runs on to its end', async () => {
    const target = await startTarget(attachParent);
    const { rootId } = await attachRoot('js-attach-tree-detach', target);
    target.go();
    const { sessionId: childId } = await waitForChildStop(rootId, /child\.js$/, CHILD_BREAKPOINT_LINE);

    const detached = await call<Stop>('detach_from_process', { sessionId: rootId });
    expect(detached.success, JSON.stringify(detached)).toBe(true);
    expect(detached.childrenReleased, JSON.stringify(detached)).toBe(1);
    expect(detached.childrenClosed).toBeUndefined();

    // Detach keeps the rows: the child is stopped and says it was released.
    const listing = await rows();
    expect(listing.find((row) => row.id === rootId)?.state).toBe('stopped');
    expect(listing.find((row) => row.id === childId)?.state).toBe('stopped');
    const childEnd = await call<Stop>('wait_for_stop', { sessionId: childId, timeout: 5000 });
    expect(childEnd.state, JSON.stringify(childEnd)).toBe('stopped');
    expect(childEnd.released, JSON.stringify(childEnd)).toBe(true);

    // Nothing was killed: the released fork finished its ticks and the parent exited with its code.
    await targetRanToItsEnd(target);
  }, 120_000);

  it('closing the attach root releases the paused fork and removes both rows; the target runs on to its end', async () => {
    const target = await startTarget(attachParent);
    const { rootId } = await attachRoot('js-attach-tree-close', target);
    target.go();
    const { sessionId: childId } = await waitForChildStop(rootId, /child\.js$/, CHILD_BREAKPOINT_LINE);

    const closed = await call<Closed>('close_debug_session', { sessionId: rootId });
    expect(closed.success, JSON.stringify(closed)).toBe(true);
    expect(closed.released, JSON.stringify(closed)).toBe(true);
    expect(closed.childrenClosed, JSON.stringify(closed)).toBe(1);
    expect(closed.processEnded).toBeUndefined();
    server.sessionId = undefined;

    const ids = (await rows()).map((row) => row.id);
    expect(ids).not.toContain(rootId);
    expect(ids).not.toContain(childId);
    await targetRanToItsEnd(target);
  }, 120_000);

  it('an attach with autoAttachChildProcesses: false keeps the fork undebugged: no child row, the target runs to its end', async () => {
    const target = await startTarget(attachParent);
    const { rootId, attached } = await attachRoot('js-attach-tree-opt-out', target, { adapterConfig: { autoAttachChildProcesses: false } });
    // The key is a supported attach key: opting out must not trip the unknown-key warning.
    expect(String(attached.warning ?? '')).not.toContain('autoAttachChildProcesses');
    target.go('now');

    const ended = await call<Stop>('wait_for_stop', { sessionId: rootId, timeout: 30000 });
    expect(ended.state, JSON.stringify(ended)).toBe('stopped');
    expect(ended.sessionId).toBe(rootId);
    expect(ended.children).toBeUndefined();
    expect((await rows()).some((row) => row.parentSessionId === rootId)).toBe(false);
    expect(target.output(), 'an opted-out attach injects no bootloader').toContain('parent go (no bootloader)');
    await targetRanToItsEnd(target);
  }, 120_000);

  /**
   * #501's wedge guard, in CI: the fork target forks a child every 2 s that
   * announces itself over IPC and exits; a child parked by the bootloader and
   * never resumed is logged `child-wedged`. With adoption on by default every
   * fork is a child session that completes its handshake.
   */
  it('forks of a forking attach target become child sessions and keep completing their handshake (issue #501)', async () => {
    const target = await startTarget(forkTarget);
    const rootId = await server.createSession('javascript', 'js-attach-tree-fork-target');
    const attached = await call<Stop>('attach_to_process', { host: '127.0.0.1', port: target.port, stopOnEntry: false, verifyTimeout: 20000 });
    expect(attached.success, JSON.stringify(attached)).toBe(true);

    const handshakes = (): number => (target.output().match(/child-handshake /g) ?? []).length;
    const baseline = handshakes();
    const listing = await pollUntil(rows, (list) => list.some((row) => row.parentSessionId === rootId), 30000);
    expect(listing.some((row) => row.parentSessionId === rootId), JSON.stringify(listing)).toBe(true);
    await pollUntil(async () => handshakes(), (count) => count > baseline, 45000, 500);
    expect(handshakes(), target.output()).toBeGreaterThan(baseline);
    expect(target.output()).not.toContain('child-wedged');

    const detached = await call<Stop>('detach_from_process', { sessionId: rootId, terminateProcess: false });
    expect(detached.success, JSON.stringify(detached)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(target.proc.exitCode, 'detach must leave the target alive').toBeNull();
  }, 120_000);
});

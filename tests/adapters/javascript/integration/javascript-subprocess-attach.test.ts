/**
 * The session tree over a by-port attach with real js-debug (issue #1082): a
 * target started with `node --inspect` that forks a Node child after the
 * attach. By default, processes the target starts afterwards are not debugged;
 * children that are already running are never scanned. The tree helper opts in
 * explicitly for future children; the opt-out case overrides it. js-debug
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
  note?: string;
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
   * moment after the attach answers, or seconds after it on a cold runner
   * (measured; a fork inside that window runs unreported; the fixture waits
   * up to 20 s), `now` at once (an attach that opted out injects nothing).
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

/** Start a script under `node --inspect=127.0.0.1:0` and read the kernel-assigned inspector port. */
async function startTarget(script: string): Promise<Target> {
  const proc = spawn(process.execPath, ['--inspect=127.0.0.1:0', script], {
    cwd: treeDir,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  let buffer = '';
  // close also waits for the output pipes, so the exit assertions see the final lines.
  const exited = new Promise<number | null>((resolve) => proc.on('close', (code) => resolve(code)));
  const target: Target = { proc, port: 0, output: () => buffer, exited, go: (mode = 'go') => { proc.stdin!.write(`${mode}\n`); } };
  // Register before readiness so afterEach also cleans up a failed startup.
  targets.push(target);
  target.port = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`node --inspect not listening: ${buffer}`)), 30000);
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      const match = /Debugger listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(buffer);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
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
  const attached = await call<Stop>('attach_to_process', { host: '127.0.0.1', port: target.port, stopOnEntry: false, verifyTimeout: 20000, adapterConfig: { autoAttachChildProcesses: true }, ...extra });
  expect(attached.success, JSON.stringify(attached)).toBe(true);
  expect(attached.state, JSON.stringify(attached)).toBe('running');
  return { rootId, attached };
}

/**
 * Wait on `sessionId` for a stop that must be a paused child of the tree at
 * `line`, and hand back its id. One wait, one answer: a child's first stop
 * anywhere else — js-debug's module-entry break surfacing under load as a
 * "debugger statement" pause at the module's first line — is the #1097
 * regression. The server verifies such a stop against the source line and
 * resumes it before anything is answered, so here it fails by name.
 */
async function waitForChildStop(sessionId: string, file: RegExp, line: number): Promise<Stop & { sessionId: string }> {
  const stop = await call<Stop>('wait_for_stop', { sessionId, timeout: 30000 });
  expect(stop.state, JSON.stringify(stop)).toBe('paused');
  expect(stop.sessionId, JSON.stringify(stop)).toBeDefined();
  expect(stop.sessionId).not.toBe(sessionId);
  expect(fileOf(stop), JSON.stringify(stop)).toMatch(file);
  expect(lineOf(stop), JSON.stringify(stop)).toBe(line);
  return stop as Stop & { sessionId: string };
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
    // The supported opt-in must not produce a configuration warning.
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
    expect(detached.note).toContain('for the rest of its life');
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

  it('never scans an existing child with its parent inspector port, with future child debugging off or on (#1286)', async () => {
    // With the scan on, the inherited fixed-port flag creates a Child Process
    // row connected to the parent. Bootloader reports cannot name this child:
    // it has already ticked before either attach starts.
    for (const autoAttachChildProcesses of [undefined, true]) {
      const target = await startTarget(path.join(treeDir, 'attach_existing_child.js'));
      await pollUntil(async () => target.output(), text => text.includes('scan target ready child='), 30000);
      expect(target.output()).toContain('scan target ready child=');
      const rootId = await server.createSession('javascript', `js-no-existing-child-scan-${autoAttachChildProcesses}`);
      const attached = await call<Stop>('attach_to_process', {
        host: '127.0.0.1', port: target.port, stopOnEntry: false, verifyTimeout: 20000,
        ...(autoAttachChildProcesses === undefined ? {} : { adapterConfig: { autoAttachChildProcesses } })
      });
      expect(attached.success, JSON.stringify(attached)).toBe(true);
      const parentTicks = (): number => (target.output().match(/parent tick /g) ?? []).length;
      const baseline = parentTicks();
      await pollUntil(async () => {
        const listing = await rows();
        const children = listing.filter(row => row.parentSessionId === rootId);
        expect(children.filter(row => row.name.startsWith('Child Process')), JSON.stringify(listing)).toEqual([]);
        expect(children, JSON.stringify(listing)).toEqual([]);
        return parentTicks();
      }, () => false, 15000);
      expect(parentTicks(), target.output()).toBeGreaterThan(baseline);
      const detached = await call<Stop>('detach_from_process', { sessionId: rootId });
      expect(detached.success, JSON.stringify(detached)).toBe(true);
    }
  }, 120_000);

  it('a default attach injects no bootloader: no child row, the target runs to its end', async () => {
    const target = await startTarget(attachParent);
    const rootId = await server.createSession('javascript', 'js-attach-tree-default');
    const bp = await call('set_breakpoint', { file: childFixture, line: CHILD_BREAKPOINT_LINE });
    expect(bp.success, JSON.stringify(bp)).toBe(true);
    const attached = await call<Stop>('attach_to_process', { host: '127.0.0.1', port: target.port, stopOnEntry: false, verifyTimeout: 20000 });
    expect(attached.success, JSON.stringify(attached)).toBe(true);
    // A default attach must not warn about the absent key.
    expect(String(attached.warning ?? '')).not.toContain('autoAttachChildProcesses');
    // Wait the fixture's full 20 s injection window before forking: a late
    // injection must fail the no-bootloader assertion too.
    target.go('go');

    const ended = await call<Stop>('wait_for_stop', { sessionId: rootId, timeout: 45000 });
    expect(ended.state, JSON.stringify(ended)).toBe('stopped');
    expect(ended.sessionId).toBe(rootId);
    expect(ended.children).toBeUndefined();
    expect((await rows()).some((row) => row.parentSessionId === rootId)).toBe(false);
    expect(target.output(), 'a default attach injects no bootloader').toContain('parent go (no bootloader)');
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
    // This immediate fork records the environment at the go signal; it does
    // not rule out a later injection (the default case waits for that).
    expect(target.output(), 'the immediate fork saw no bootloader').toContain('parent go (no bootloader)');
    await targetRanToItsEnd(target);
  }, 120_000);

  it('explains a pending child-only breakpoint on a default attach (#1288)', async () => {
    const target = await startTarget(forkTarget);
    const rootId = await server.createSession('javascript', 'js-attach-child-only-note');
    const bp = await call('set_breakpoint', { file: forkTarget, line: 21 });
    expect(bp.success, JSON.stringify(bp)).toBe(true);
    const attached = await call<Stop>('attach_to_process', { host: '127.0.0.1', port: target.port, verifyTimeout: 20000 });
    expect(attached.success, JSON.stringify(attached)).toBe(true);
    expect(String(attached.note ?? '')).not.toContain('or set a breakpoint');
    await call('continue_execution', { sessionId: rootId });
    const baseline = (target.output().match(/child-handshake /g) ?? []).length;
    const pending = await call<Stop>('wait_for_stop', { sessionId: rootId, timeout: 10000 });
    expect(pending.pending, JSON.stringify(pending)).toBe(true);
    expect(pending.message).toContain("If a breakpoint's code runs only in a process the target starts (a fork or a worker process), this attach does not debug that process: see adapterConfig.autoAttachChildProcesses in the attach_to_process description for what turning that on costs.");
    expect((target.output().match(/child-handshake /g) ?? []).length).toBeGreaterThan(baseline);
    const detached = await call<Stop>('detach_from_process', { sessionId: rootId });
    expect(detached.released, JSON.stringify(detached)).toBe(true);
    expect(detached.note).toBeUndefined();
  }, 120_000);

  /**
   * #501's wedge guard, in CI: the fork target forks a child every 2 s that
   * announces itself over IPC and exits; a child parked by the bootloader and
   * never resumed is logged `child-wedged`. The default case guards untouched,
   * undebugged forks; the explicit opt-in case guards adoption and handshakes.
   */
  it('forks of a forking attach target stay undebugged and keep completing their handshake by default (issue #1286)', async () => {
    const target = await startTarget(forkTarget);
    const rootId = await server.createSession('javascript', 'js-attach-default-fork-target');
    const attached = await call<Stop>('attach_to_process', { host: '127.0.0.1', port: target.port, stopOnEntry: false, verifyTimeout: 20000 });
    expect(attached.success, JSON.stringify(attached)).toBe(true);
    expect(String(attached.warning ?? '')).not.toContain('autoAttachChildProcesses');

    const handshakes = (): number => (target.output().match(/child-handshake /g) ?? []).length;
    const baseline = handshakes();
    // Allow the same 30 s adoption window as the opt-in case.
    await pollUntil(async () => {
      const listing = await rows();
      expect(listing.some((row) => row.parentSessionId === rootId), JSON.stringify(listing)).toBe(false);
      expect(target.output()).not.toContain('child-wedged');
      return handshakes();
    }, () => false, 30000, 250);
    expect(handshakes(), target.output()).toBeGreaterThanOrEqual(baseline + 2);

    const detached = await call<Stop>('detach_from_process', { sessionId: rootId, terminateProcess: false });
    expect(detached.success, JSON.stringify(detached)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 6000));
    expect(target.proc.exitCode, 'detach must leave the target alive').toBeNull();
    expect(target.output()).not.toContain('child-wedged');
  }, 120_000);

  it('forks of a forking attach target become child sessions and keep completing their handshake (issue #501)', async () => {
    const target = await startTarget(forkTarget);
    const rootId = await server.createSession('javascript', 'js-attach-tree-fork-target');
    const attached = await call<Stop>('attach_to_process', { host: '127.0.0.1', port: target.port, stopOnEntry: false, verifyTimeout: 20000, adapterConfig: { autoAttachChildProcesses: true } });
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

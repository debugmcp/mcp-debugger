/**
 * stackTrace annotation (program/paragraph labels, generated-C remap) and the
 * synthetic COBOL scopes.
 */
import { describe, expect, it, afterEach } from 'vitest';
import path from 'node:path';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { engineError, installMemory } from './fake-engine.js';
import { callsManifest, callsMemory, helloManifest } from './fixtures.js';
import { bringUp, frame, startShim, stopWithFrames, tick, type Harness } from './harness.js';

const ROOT = path.resolve('/work/cobol/examples');
const HELLO_COB = path.join(ROOT, 'hello.cob');
const HELLO_C = path.join(ROOT, 'build', 'hello.c');
const MAIN_C = path.join(ROOT, 'build', 'main.c');
const SUB_COB = path.join(ROOT, 'calls', 'sub.cob');

function scopesOf(response: DebugProtocol.Response): DebugProtocol.Scope[] {
  return (response.body as DebugProtocol.ScopesResponse['body']).scopes;
}

describe('cobol shim stackTrace and scopes', () => {
  let h: Harness | undefined;

  afterEach(async () => {
    await h?.cleanup();
    h = undefined;
  });

  it('labels COBOL frames "<PROGRAM-ID>: <paragraph>" and leaves entry wrapper, main and CRT frames alone', async () => {
    h = await startShim({ manifests: [helloManifest(ROOT)] });
    await bringUp(h);
    const frames = await stopWithFrames(h, [
      frame(1, 'HELLO_', HELLO_COB, 38),
      frame(2, 'HELLO', HELLO_C, 220),
      frame(3, 'main', HELLO_C, 250),
      frame(4, '@__libc_start_main', undefined, 0)
    ]);
    expect(frames.map((f) => f.name)).toEqual(['HELLO: 1000-INIT', 'HELLO', 'main', '@__libc_start_main']);
    expect(frames[0].source?.path).toBe(HELLO_COB);
    expect(frames[0].line).toBe(38);
  });

  it('maps a generated-C location of the body function back to the COBOL line via the line map', async () => {
    h = await startShim({ manifests: [helloManifest(ROOT)] });
    await bringUp(h);
    const frames = await stopWithFrames(h, [frame(1, 'HELLO_', HELLO_C, 133), frame(2, 'main', HELLO_C, 250)]);
    expect(frames[0].name).toBe('HELLO: 0000-MAIN [hello.c:133]');
    expect(frames[0].line).toBe(32);
    expect(frames[0].source?.path).toBe(path.normalize(HELLO_COB));
    expect(frames[0].source?.name).toBe('hello.cob');
    expect(frames[1].name).toBe('main');
    expect(frames[1].line).toBe(250);
  });

  it('matches Windows-style engine paths against the manifest case-insensitively with normalised separators', async () => {
    h = await startShim({ manifests: [helloManifest('C:/work/cobol/examples')] });
    await bringUp(h);
    const frames = await stopWithFrames(h, [frame(1, 'HELLO_', 'c:\\Work\\COBOL\\examples\\HELLO.cob', 33)]);
    expect(frames[0].name).toBe('HELLO: 0000-MAIN');
  });

  it('serves WORKING-STORAGE scope for a COBOL frame and forwards scopes for other frames', async () => {
    h = await startShim({
      manifests: [helloManifest(ROOT)],
      engineSetup: (engine) => engine.on('scopes', () => ({ scopes: [{ name: 'Local', variablesReference: 12, expensive: false }] }))
    });
    await bringUp(h);
    await stopWithFrames(h, [frame(1, 'HELLO_', HELLO_COB, 32), frame(2, 'main', HELLO_C, 250)]);
    const cobol = scopesOf(await h.client.request('scopes', { frameId: 1 }));
    expect(cobol.map((s) => s.name)).toEqual(['WORKING-STORAGE']);
    expect(cobol[0].namedVariables).toBe(9);
    expect(cobol[0].variablesReference).toBeGreaterThanOrEqual(1 << 30);
    expect(h.engine.received('scopes')).toHaveLength(0);

    const native = scopesOf(await h.client.request('scopes', { frameId: 2 }));
    expect(native.map((s) => s.name)).toEqual(['Local']);
    expect(h.engine.received('scopes')).toHaveLength(1);
  });

  it('serves the nearest COBOL program up the stack, named for it, when the frame is inside libcob or a C helper', async () => {
    h = await startShim({
      manifests: [helloManifest(ROOT)],
      engineSetup: (engine) => engine.on('scopes', () => ({ scopes: [{ name: 'Local', variablesReference: 12, expensive: false }] }))
    });
    await bringUp(h);
    // Attached to a batch job asleep in C$SLEEP: libcob frames without source on top.
    await stopWithFrames(h, [
      frame(1, 'nanosleep', undefined, 0),
      frame(2, 'cob_sys_sleep', undefined, 0),
      frame(3, 'HELLO_', HELLO_COB, 40),
      frame(4, 'main', HELLO_C, 250)
    ]);
    const scopes = scopesOf(await h.client.request('scopes', { frameId: 1 }));
    expect(scopes.map((s) => s.name)).toEqual(['WORKING-STORAGE of HELLO (1000-INIT, 2 frames up)']);
    expect(scopes[0].namedVariables).toBe(9);
    expect(scopes[0].variablesReference).toBeGreaterThanOrEqual(1 << 30);
    expect(h.engine.received('scopes')).toHaveLength(0);
    // The frame the COBOL frame itself gets: bare names, same program.
    expect(scopesOf(await h.client.request('scopes', { frameId: 3 })).map((s) => s.name)).toEqual(['WORKING-STORAGE']);
    // Below every COBOL frame there is nothing to walk up to: the engine answers.
    expect(scopesOf(await h.client.request('scopes', { frameId: 4 })).map((s) => s.name)).toEqual(['Local']);
  });

  it('fetches a deeper stack for the walk-up when the client only asked for the top frame (get_local_variables does)', async () => {
    h = await startShim({
      manifests: [helloManifest(ROOT)],
      engineSetup: (engine) => engine.on('scopes', () => ({ scopes: [{ name: 'Local', variablesReference: 12, expensive: false }] }))
    });
    await bringUp(h);
    const frames = [
      frame(1, 'nanosleep', undefined, 0),
      frame(2, 'cob_sys_sleep', undefined, 0),
      frame(3, 'HELLO_', HELLO_COB, 40),
      frame(4, 'main', HELLO_C, 250)
    ];
    h.engine.on('stackTrace', (args: DebugProtocol.StackTraceArguments) => {
      const start = args.startFrame ?? 0;
      const levels = args.levels && args.levels > 0 ? args.levels : frames.length;
      return { stackFrames: frames.slice(start, start + levels), totalFrames: frames.length };
    });
    // A breakpoint stop: the shim fetches nothing on its own (a pause would already have
    // walked the stack to check the thread), so the client's one-frame request is all it holds.
    h.engine.emit('stopped', { reason: 'breakpoint', hitBreakpointIds: [9], threadId: 1, allThreadsStopped: true });
    await h.client.nextEvent('stopped');
    // Only the top frame is in the shim's cache after this.
    await h.client.request('stackTrace', { threadId: 1, startFrame: 0, levels: 1 });

    const scopes = scopesOf(await h.client.request('scopes', { frameId: 1 }));
    expect(scopes.map((s) => s.name)).toEqual(['WORKING-STORAGE of HELLO (1000-INIT, 2 frames up)']);
    expect(h.engine.received('stackTrace')).toHaveLength(2);
    expect(h.engine.received('stackTrace')[1].arguments).toMatchObject({ threadId: 1, levels: 64 });
    expect(h.engine.received('scopes')).toHaveLength(0);
    // Once per thread and generation: a second walk-up in the same stop reuses the deep fetch.
    await h.client.request('scopes', { frameId: 2 });
    await h.client.request('evaluate', { expression: 'WS-COUNT', frameId: 2 });
    expect(h.engine.received('stackTrace')).toHaveLength(2);
  });

  it('forwards scopes without a walk-up when no manifest is loaded (nothing could be COBOL)', async () => {
    h = await startShim({
      manifests: [],
      engineSetup: (engine) => engine.on('scopes', () => ({ scopes: [{ name: 'Local', variablesReference: 12, expensive: false }] }))
    });
    await bringUp(h);
    await stopWithFrames(h, [frame(1, 'nanosleep', undefined, 0), frame(2, 'main', HELLO_C, 250)]);
    const before = h.engine.received('stackTrace').length;
    expect(scopesOf(await h.client.request('scopes', { frameId: 1 })).map((s) => s.name)).toEqual(['Local']);
    expect(h.engine.received('stackTrace')).toHaveLength(before);
  });

  it('re-anchors an attach/pause stop reported on a thread outside COBOL onto the thread inside the program', async () => {
    h = await startShim({ manifests: [helloManifest(ROOT)] });
    await h.client.request('initialize', { clientID: 'test', adapterID: 'lldb' });
    await h.client.request('attach', { pid: 4242, __cobol: { manifestDirs: [h.manifestDir] } });
    // Windows attach: the OS injects a break thread (0x80000003); the job sleeps on its main thread.
    const stacks: Record<number, DebugProtocol.StackFrame[]> = {
      7: [frame(71, 'NtWaitForWorkViaWorkerFactory', undefined, 0), frame(72, 'TpCallbackMayRunLong', undefined, 0)],
      1: [frame(11, 'NtDelayExecution', undefined, 0), frame(12, 'cob_sys_sleep', undefined, 0), frame(13, 'HELLO_', HELLO_COB, 40), frame(14, 'main', HELLO_C, 250)]
    };
    h.engine.on('threads', () => ({ threads: [{ id: 7, name: 'thread #3' }, { id: 1, name: 'main' }] }));
    h.engine.on('stackTrace', (args: DebugProtocol.StackTraceArguments) => {
      const frames = stacks[args.threadId] ?? [];
      return { stackFrames: frames.slice(args.startFrame ?? 0, (args.startFrame ?? 0) + (args.levels || frames.length)), totalFrames: frames.length };
    });
    h.engine.emit('stopped', { reason: 'exception', description: 'Exception 0x80000003 encountered at address 0x7ffb59163ab0', threadId: 7, allThreadsStopped: true });
    const stopped = await h.client.nextEvent('stopped');

    // Shown as the pause it is (no exceptionInfo will be asked about a thread without one).
    expect(stopped.body).toMatchObject({ reason: 'pause', threadId: 1, allThreadsStopped: true });
    expect(stopped.body.description).toBe('Attached (reported on thread 7 as "Exception 0x80000003 encountered at address 0x7ffb59163ab0"; shown on thread 1, inside the COBOL program)');
    expect(h.engine.received('threads')).toHaveLength(1);
    // The client's first stackTrace on the reported thread is the COBOL one, and scopes walk up within it.
    const frames = (await h.client.request('stackTrace', { threadId: 1, startFrame: 0, levels: 20 })).body.stackFrames as DebugProtocol.StackFrame[];
    expect(frames.map((f) => f.name)).toEqual(['NtDelayExecution', 'cob_sys_sleep', 'HELLO: 1000-INIT', 'main']);
    expect(scopesOf(await h.client.request('scopes', { frameId: 11 })).map((s) => s.name)).toEqual(['WORKING-STORAGE of HELLO (1000-INIT, 2 frames up)']);
  });

  it('re-anchors the stop that answers a forwarded pause, but not a later trap the program raised itself', async () => {
    h = await startShim({ manifests: [helloManifest(ROOT)] });
    await bringUp(h);
    const stacks: Record<number, DebugProtocol.StackFrame[]> = {
      7: [frame(71, 'NtWaitForWorkViaWorkerFactory', undefined, 0)],
      1: [frame(11, 'NtDelayExecution', undefined, 0), frame(12, 'cob_sys_sleep', undefined, 0), frame(13, 'HELLO_', HELLO_COB, 40), frame(14, 'main', HELLO_C, 250)]
    };
    h.engine.on('threads', () => ({ threads: [{ id: 7, name: 'thread #3' }, { id: 1, name: 'main' }] }));
    h.engine.on('stackTrace', (args: DebugProtocol.StackTraceArguments) => ({ stackFrames: stacks[args.threadId] ?? [], totalFrames: (stacks[args.threadId] ?? []).length }));
    // A launch session (no attach handshake): the first exception stop is the program's own trap.
    h.engine.emit('stopped', { reason: 'exception', description: 'Exception 0x80000003 encountered at address 0x1', threadId: 7, allThreadsStopped: true });
    expect((await h.client.nextEvent('stopped')).body).toMatchObject({ reason: 'exception', threadId: 7 });
    expect(h.engine.received('threads')).toHaveLength(0);
    // After a client pause, the same-looking stop is the debugger's: re-anchored.
    void h.client.request('pause', { threadId: 7 });
    await tick(30);
    h.engine.emit('stopped', { reason: 'exception', description: 'Exception 0x80000003 encountered at address 0x1', threadId: 7, allThreadsStopped: true });
    expect((await h.client.nextEvent('stopped')).body).toMatchObject({ reason: 'pause', threadId: 1 });
    expect(h.engine.received('threads')).toHaveLength(1);
    // The pause was consumed: the next trap stays where it happened.
    h.engine.emit('stopped', { reason: 'exception', description: 'Exception 0x80000003 encountered at address 0x1', threadId: 7, allThreadsStopped: true });
    expect((await h.client.nextEvent('stopped')).body).toMatchObject({ reason: 'exception', threadId: 7 });
    expect(h.engine.received('threads')).toHaveLength(1);
    // A pause the engine refuses answers nothing: it must not arm the gate for a later trap.
    h.engine.on('pause', () => engineError('process is not running'));
    const refused = await h.client.request('pause', { threadId: 7 });
    expect(refused.success).toBe(false);
    h.engine.emit('stopped', { reason: 'exception', description: 'Exception 0x80000003 encountered at address 0x1', threadId: 7, allThreadsStopped: true });
    expect((await h.client.nextEvent('stopped')).body).toMatchObject({ reason: 'exception', threadId: 7 });
    expect(h.engine.received('threads')).toHaveLength(1);
  });

  it('does not spend the attach-handshake credit when the attach asked for no stop on entry', async () => {
    h = await startShim({ manifests: [helloManifest(ROOT)] });
    await h.client.request('initialize', { clientID: 'test', adapterID: 'lldb' });
    await h.client.request('attach', { pid: 4242, stopOnEntry: false, __cobol: { manifestDirs: [h.manifestDir] } });
    h.engine.on('threads', () => ({ threads: [{ id: 7, name: 'thread #3' }, { id: 1, name: 'main' }] }));
    h.engine.on('stackTrace', () => ({ stackFrames: [frame(71, 'worker', undefined, 0)], totalFrames: 1 }));
    // CodeLLDB resumed after the attach: the first stop it reports is the program's own trap.
    h.engine.emit('stopped', { reason: 'exception', description: 'Exception 0x80000003 encountered at address 0x1', threadId: 7, allThreadsStopped: true });
    expect((await h.client.nextEvent('stopped')).body).toMatchObject({ reason: 'exception', threadId: 7 });
    expect(h.engine.received('threads')).toHaveLength(0);
  });

  it('leaves a breakpoint stop, a step stop, an entry stop and a real fault on the thread the engine reported', async () => {
    h = await startShim({ manifests: [helloManifest(ROOT)] });
    await bringUp(h);
    h.engine.on('threads', () => ({ threads: [{ id: 7, name: 'thread #3' }, { id: 1, name: 'main' }] }));
    h.engine.on('stackTrace', () => ({ stackFrames: [frame(71, 'worker', undefined, 0)], totalFrames: 1 }));
    for (const body of [
      { reason: 'breakpoint', threadId: 7, hitBreakpointIds: [3] },
      { reason: 'step', threadId: 7 },
      { reason: 'entry', threadId: 7 },
      { reason: 'exception', description: 'Exception 0xc0000005 encountered at address 0x1', threadId: 7 },
      // A trap in the program's own code, no pause in flight and no attach handshake: the program's.
      { reason: 'exception', description: 'Exception 0x80000003 encountered at address 0x1', threadId: 7 }
    ]) {
      h.engine.emit('stopped', { allThreadsStopped: true, ...body });
      const stopped = await h.client.nextEvent('stopped');
      expect(stopped.body.threadId).toBe(7);
      expect(stopped.body.description).toBe(body.description);
    }
    expect(h.engine.received('threads')).toHaveLength(0);
  });

  it('adds LOCAL-STORAGE and LINKAGE only when the program has them, and appends engine scopes under --engine-scopes', async () => {
    h = await startShim({
      manifests: [callsManifest(ROOT)],
      argv: { engineScopes: true },
      engineSetup: (engine) => {
        installMemory(engine, callsMemory());
        engine.on('scopes', () => ({ scopes: [{ name: 'Local', variablesReference: 12, expensive: false }, { name: 'Static', variablesReference: 13, expensive: true }] }));
      }
    });
    await bringUp(h);
    await stopWithFrames(h, [frame(1, 'CALLSUB_', SUB_COB, 15), frame(2, 'CALLMAIN_', MAIN_C, 139)]);
    const sub = scopesOf(await h.client.request('scopes', { frameId: 1 }));
    expect(sub.map((s) => s.name)).toEqual(['WORKING-STORAGE', 'LOCAL-STORAGE', 'LINKAGE', 'Local', 'Static']);
    expect(sub[0].namedVariables).toBe(0);
    expect(sub[1].namedVariables).toBe(2);
    expect(sub[2].namedVariables).toBe(1);
    const main = scopesOf(await h.client.request('scopes', { frameId: 2 }));
    expect(main.map((s) => s.name)).toEqual(['WORKING-STORAGE', 'Local', 'Static']);
  });

  it('refetches the stack once for a frameId it has not seen this generation', async () => {
    const frames = [frame(1, 'HELLO_', HELLO_COB, 32), frame(2, 'main', HELLO_C, 250)];
    h = await startShim({
      manifests: [helloManifest(ROOT)],
      engineSetup: (engine) => {
        engine.on('stackTrace', () => ({ stackFrames: frames, totalFrames: 2 }));
        engine.on('scopes', () => ({ scopes: [{ name: 'Local', variablesReference: 12, expensive: false }] }));
      }
    });
    await bringUp(h);
    h.engine.emit('stopped', { reason: 'breakpoint', threadId: 1 });
    await h.client.nextEvent('stopped');
    // No client stackTrace yet: the shim must ask the engine itself.
    const cobol = scopesOf(await h.client.request('scopes', { frameId: 1 }));
    expect(cobol.map((s) => s.name)).toEqual(['WORKING-STORAGE']);
    expect(h.engine.received('stackTrace')).toHaveLength(1);
    expect(h.engine.received('stackTrace')[0].arguments).toMatchObject({ threadId: 1, startFrame: 0, levels: 64 });
    // Still unknown after the refetch: forwarded.
    const unknown = await h.client.request('scopes', { frameId: 99 });
    expect(scopesOf(unknown).map((s) => s.name)).toEqual(['Local']);
  });
});

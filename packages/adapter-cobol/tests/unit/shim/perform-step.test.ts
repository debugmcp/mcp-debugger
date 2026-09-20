/**
 * PERFORM-aware stepping (milestone M3): `next` on a PERFORM statement runs to the
 * statement after it instead of walking into the paragraph; `stepOut` inside a
 * performed range runs to its return and on to the statement after the PERFORM
 * that entered it. Temporary stops are a source breakpoint in the file's union
 * and an instruction breakpoint on the range's return address; both are dropped
 * on the way out, whichever way the step ends.
 */
import { describe, expect, it, afterEach } from 'vitest';
import path from 'node:path';
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { CobolManifest } from '../../../src/manifest/schema.js';
import { DEPTH_EXPRESSION } from '../../../src/shim/perform-frames.js';
import type { FakeEngine } from './fake-engine.js';
import { helloManifest } from './fixtures.js';
import { bringUp, frame, startShim, tick, type Harness } from './harness.js';

const ROOT = path.resolve('/work/cobol/examples');
const HELLO_COB = path.join(ROOT, 'hello.cob');
const HELLO_C = path.join(ROOT, 'build', 'hello.c');
const RETURN_ADDRESS = 140698323261470n; // 0x7ff6e194181e
const INSTRUCTION_ID = 77;

function helloWithStatements(): CobolManifest {
  const manifest = helloManifest(ROOT);
  manifest.programs[0].procedure.statements = [
    { sourceFileId: 1, line: 32, verb: 'PERFORM' },
    { sourceFileId: 1, line: 33, verb: 'PERFORM' },
    { sourceFileId: 1, line: 34, verb: 'PERFORM' },
    { sourceFileId: 1, line: 35, verb: 'STOP RUN' },
    { sourceFileId: 1, line: 37, verb: 'MOVE' },
    { sourceFileId: 1, line: 38, verb: 'PERFORM' },
    { sourceFileId: 1, line: 39, verb: 'COMPUTE' }
  ];
  return manifest;
}

interface Rig {
  /** What `stackTrace` reports now. */
  position: DebugProtocol.StackFrame;
  /** What the depth expression answers now. */
  depth: number;
  /** Stops each `next` advances to (frame + depth); the last one repeats. */
  nextStops: Array<{ frame: DebugProtocol.StackFrame; depth?: number }>;
  /** Stops each `continue` advances to. */
  continueStops: Array<{ frame: DebugProtocol.StackFrame; depth?: number; stopped: Partial<DebugProtocol.StoppedEvent['body']> }>;
  commands: string[];
  breakpointSends: DebugProtocol.SetBreakpointsArguments[];
  instructionSends: DebugProtocol.SetInstructionBreakpointsArguments[];
}

/** A CodeLLDB-shaped engine for one COBOL program: ids per line, the PERFORM stack readable, scripted stops. */
function rigEngine(engine: FakeEngine, start: DebugProtocol.StackFrame, depth: number): Rig {
  const rig: Rig = { position: start, depth, nextStops: [], continueStops: [], commands: [], breakpointSends: [], instructionSends: [] };
  const ids = new Map<number, number>();
  let nextId = 1;
  engine.on('setBreakpoints', (args: DebugProtocol.SetBreakpointsArguments) => {
    rig.breakpointSends.push(args);
    return {
      breakpoints: (args.breakpoints ?? []).map((bp) => {
        if (!ids.has(bp.line)) {
          ids.set(bp.line, nextId++);
        }
        return { id: ids.get(bp.line), line: bp.line, verified: true };
      })
    };
  });
  engine.on('setInstructionBreakpoints', (args: DebugProtocol.SetInstructionBreakpointsArguments) => {
    rig.instructionSends.push(args);
    return { breakpoints: args.breakpoints.map((bp) => ({ id: INSTRUCTION_ID, verified: true, instructionReference: bp.instructionReference })) };
  });
  engine.on('stackTrace', () => ({ stackFrames: [{ ...rig.position, source: rig.position.source ? { ...rig.position.source } : undefined }], totalFrames: 1 }));
  engine.on('evaluate', (args: { expression: string }) => {
    if (args.expression === DEPTH_EXPRESSION) {
      return { result: String(rig.depth), variablesReference: 0 };
    }
    if (/frame_stack\[\d+\]\.return_address_ptr/.test(args.expression)) {
      return { result: RETURN_ADDRESS.toString(), variablesReference: 0 };
    }
    if (args.expression.startsWith('/py ') && args.expression.includes('ResolveLoadAddress')) {
      // Python's repr of the path: backslashes doubled on Windows.
      return { result: `('${HELLO_C.replace(/\\/g, '\\\\')}', 130)`, variablesReference: 0 };
    }
    throw new Error(`unexpected evaluate ${args.expression}`);
  });
  const advance = (command: string, list: Rig['nextStops'] | Rig['continueStops']) => () => {
    rig.commands.push(command);
    const stop = list.length > 1 ? list.shift()! : list[0];
    if (!stop) {
      throw new Error(`no scripted stop for ${command}`);
    }
    rig.position = stop.frame;
    if (stop.depth !== undefined) {
      rig.depth = stop.depth;
    }
    const extra = (stop as { stopped?: Partial<DebugProtocol.StoppedEvent['body']> }).stopped ?? {};
    const body = { reason: 'step', threadId: 1, allThreadsStopped: true, ...extra };
    setImmediate(() => engine.emit('stopped', body));
    return {};
  };
  engine.on('next', advance('next', rig.nextStops));
  engine.on('stepIn', advance('stepIn', rig.nextStops));
  engine.on('stepOut', advance('stepOut', rig.nextStops));
  engine.on('continue', advance('continue', rig.continueStops));
  return rig;
}

const lineIdOf = (rig: Rig, line: number): number => {
  // ids are handed out in first-seen order across sends; recover from the recorded sends
  const seen: number[] = [];
  for (const send of rig.breakpointSends) {
    for (const bp of send.breakpoints ?? []) {
      if (!seen.includes(bp.line)) {
        seen.push(bp.line);
      }
    }
  }
  return seen.indexOf(line) + 1;
};

describe('cobol shim PERFORM-aware stepping', () => {
  let h: Harness | undefined;

  afterEach(async () => {
    await h?.cleanup();
    h = undefined;
  });

  it('next on a PERFORM runs to the statement after it: a temporary line, a continue, one step-shaped stop, temps dropped', async () => {
    let rig!: Rig;
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => { rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 32), 0); } });
    await bringUp(h);
    rig.continueStops.push({ frame: frame(1, 'HELLO_', HELLO_COB, 33), depth: 0, stopped: { reason: 'breakpoint', hitBreakpointIds: [1] } });

    const response = await h.client.request('next', { threadId: 1 });
    expect(response.success).toBe(true);
    expect(response.command).toBe('next');
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'step', threadId: 1, description: 'stepped over the PERFORM at hello.cob:32' });
    expect(stopped.body).not.toHaveProperty('hitBreakpointIds');
    await tick(30);
    expect(h.client.events('stopped')).toHaveLength(1);
    expect(h.client.events('continued')).toHaveLength(0);
    expect(rig.commands).toEqual(['continue']);
    // The temp line 33 was armed in the file's union, then dropped; no instruction breakpoint at depth 0.
    expect(rig.breakpointSends.map((s) => (s.breakpoints ?? []).map((b) => b.line))).toEqual([[33], []]);
    expect(rig.instructionSends).toHaveLength(0);
    const frames = ((await h.client.request('stackTrace', { threadId: 1 })).body as DebugProtocol.StackTraceResponse['body']).stackFrames;
    expect(frames[0].line).toBe(33);
  });

  it('next on a PERFORM keeps the user\'s own line breakpoints in the union and surfaces one of them hit mid-way as a breakpoint', async () => {
    let rig!: Rig;
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => { rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 32), 0); } });
    await bringUp(h);
    await h.client.request('setBreakpoints', { source: { path: HELLO_COB }, breakpoints: [{ line: 39 }] });
    const userId = lineIdOf(rig, 39);
    rig.continueStops.push({ frame: frame(1, 'HELLO_', HELLO_COB, 39), depth: 1, stopped: { reason: 'breakpoint', hitBreakpointIds: [userId] } });

    await h.client.request('next', { threadId: 1 });
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'breakpoint', hitBreakpointIds: [userId] });
    expect(rig.breakpointSends.map((s) => (s.breakpoints ?? []).map((b) => b.line))).toEqual([[39], [39, 33], [39]]);
  });

  it('next on an ordinary statement is the statement walk: no depth read, no continue, no temps', async () => {
    let rig!: Rig;
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => { rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 37), 1); } });
    await bringUp(h);
    rig.nextStops.push({ frame: frame(1, 'HELLO_', HELLO_C, 210) }, { frame: frame(1, 'HELLO_', HELLO_COB, 38) });
    await h.client.request('next', { threadId: 1 });
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'step' });
    expect(rig.commands).toEqual(['next', 'next']);
    expect(rig.breakpointSends).toHaveLength(0);
    expect(h.engine.received('evaluate')).toHaveLength(0);
  });

  it('stepOut inside a performed paragraph runs to its return, walks to the statement after the PERFORM, and says so', async () => {
    let rig!: Rig;
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => { rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 37), 1); } });
    await bringUp(h);
    // continue → the instruction breakpoint on the return address (generated C after the goto), still depth 1
    rig.continueStops.push({ frame: frame(1, 'HELLO_', HELLO_C, 140), depth: 1, stopped: { reason: 'breakpoint', hitBreakpointIds: [INSTRUCTION_ID] } });
    // then the walk: two generated lines, then the COBOL statement after the PERFORM at depth 0
    rig.nextStops.push({ frame: frame(1, 'HELLO_', HELLO_C, 141) }, { frame: frame(1, 'HELLO_', HELLO_C, 146) }, { frame: frame(1, 'HELLO_', HELLO_COB, 33), depth: 0 });

    const response = await h.client.request('stepOut', { threadId: 1 });
    expect(response.success).toBe(true);
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'step', description: 'returned from 1000-INIT to 0000-MAIN' });
    expect(rig.commands).toEqual(['continue', 'next', 'next', 'next']);
    // The statement after the performer: the return address maps to hello.c:130 → line 32 → next statement 33.
    expect(rig.breakpointSends.map((s) => (s.breakpoints ?? []).map((b) => b.line))).toEqual([[33], []]);
    expect(rig.instructionSends.map((s) => s.breakpoints.map((b) => b.instructionReference))).toEqual([['0x7ff6e194181e'], []]);
    await tick(30);
    expect(h.client.events('stopped')).toHaveLength(1);
  });

  it('stepOut from a range a PERFORM … TIMES re-enters continues to the statement after the PERFORM', async () => {
    let rig!: Rig;
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => { rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 37), 1); } });
    await bringUp(h);
    rig.continueStops.push(
      { frame: frame(1, 'HELLO_', HELLO_C, 140), depth: 1, stopped: { reason: 'breakpoint', hitBreakpointIds: [INSTRUCTION_ID] } },
      { frame: frame(1, 'HELLO_', HELLO_COB, 33), depth: 0, stopped: { reason: 'breakpoint', hitBreakpointIds: [1] } }
    );
    // The walk after the return lands back inside 1000-INIT (the loop's next iteration), depth 1 again.
    rig.nextStops.push({ frame: frame(1, 'HELLO_', HELLO_C, 141) }, { frame: frame(1, 'HELLO_', HELLO_COB, 37), depth: 1 });

    await h.client.request('stepOut', { threadId: 1 });
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'step', description: 'returned from 1000-INIT to 0000-MAIN' });
    expect(rig.commands).toEqual(['continue', 'next', 'next', 'continue']);
    const frames = ((await h.client.request('stackTrace', { threadId: 1 })).body as DebugProtocol.StackTraceResponse['body']).stackFrames;
    expect(frames[0].line).toBe(33);
  });

  it('stepOut outside any PERFORM is the engine\'s stepOut (leaving the program), not a plan', async () => {
    let rig!: Rig;
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => { rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 33), 0); } });
    await bringUp(h);
    rig.nextStops.push({ frame: frame(2, 'main', HELLO_C, 40) });
    await h.client.request('stepOut', { threadId: 1 });
    await h.client.nextEvent('stopped');
    expect(rig.commands).toEqual(['stepOut']);
    expect(rig.breakpointSends).toHaveLength(0);
    expect(rig.instructionSends).toHaveLength(0);
  });

  it('a client continue while the plan is running drops the temporary stops before it goes to the engine', async () => {
    let rig!: Rig;
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => { rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 37), 1); } });
    await bringUp(h);
    // The plan's continue never stops (a long PERFORM UNTIL); the client gives up and continues itself.
    h.engine.on('continue', () => {
      rig.commands.push('continue');
      return {};
    });
    await h.client.request('stepOut', { threadId: 1 });
    await tick(30);
    expect(rig.breakpointSends.map((s) => (s.breakpoints ?? []).map((b) => b.line))).toEqual([[33]]);
    const response = await h.client.request('continue', { threadId: 1 });
    expect(response.success).toBe(true);
    expect(rig.commands).toEqual(['continue', 'continue']);
    expect(rig.breakpointSends.map((s) => (s.breakpoints ?? []).map((b) => b.line))).toEqual([[33], []]);
    expect(rig.instructionSends).toHaveLength(2);
    expect(rig.instructionSends[1].breakpoints).toEqual([]);
    // A stop that arrives afterwards is the client's, untouched.
    rig.position = frame(1, 'HELLO_', HELLO_COB, 39);
    h.engine.emit('stopped', { reason: 'pause', threadId: 1, allThreadsStopped: true });
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'pause' });
  });

  it('falls back to the statement walk when the frame has no PERFORM stack to read', async () => {
    let rig!: Rig;
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => { rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 32), 0); } });
    await bringUp(h);
    h.engine.on('evaluate', () => {
      throw new Error("use of undeclared identifier 'frame_ptr'");
    });
    rig.nextStops.push({ frame: frame(1, 'HELLO_', HELLO_C, 127) }, { frame: frame(1, 'HELLO_', HELLO_COB, 36) });
    await h.client.request('next', { threadId: 1 });
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'step' });
    expect(rig.commands).toEqual(['next', 'next']);
    expect(rig.breakpointSends).toHaveLength(0);
  });
});

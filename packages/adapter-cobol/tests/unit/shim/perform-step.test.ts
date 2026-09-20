/**
 * PERFORM-aware stepping (milestone M3), driven by libcob's PERFORM stack: a `next`
 * whose landing is deeper than its origin entered a performed range, so the shim
 * arms an instruction breakpoint on that range's return address, resumes, and
 * walks on from the return — once per iteration of a PERFORM … TIMES; `stepOut`
 * inside a range arms the range's own return and is done at a shallower landing.
 * The return stop is dropped on every exit. The flows scripted here mirror what
 * was measured on GnuCOBOL 3.2 with examples/cobol/perform.cob (see the e2e).
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

interface Stop {
  cLine?: number;
  frame: DebugProtocol.StackFrame;
  /** The PERFORM depth the engine reports from this stop on. */
  depth?: number;
  stopped?: Partial<DebugProtocol.StoppedEvent['body']>;
}

interface Rig {
  cLine?: number;
  controlReturns?: Record<number, number>;
  position: DebugProtocol.StackFrame;
  depth: number;
  /** Stops each `next`/`stepIn`/`stepOut` advances to; the last one repeats. */
  nextStops: Stop[];
  /** Stops each `continue` advances to; the last one repeats. */
  continueStops: Stop[];
  commands: string[];
  breakpointSends: DebugProtocol.SetBreakpointsArguments[];
  instructionSends: DebugProtocol.SetInstructionBreakpointsArguments[];
  returnAddressReads: string[];
}

/** A CodeLLDB-shaped engine for one COBOL program: ids per line, the PERFORM stack readable, scripted stops. */
function rigEngine(engine: FakeEngine, start: DebugProtocol.StackFrame, depth: number): Rig {
  const rig: Rig = { position: start, depth, nextStops: [], continueStops: [], commands: [], breakpointSends: [], instructionSends: [], returnAddressReads: [] };
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
    const through = /frame_stack\[(\d+)\]\.perform_through/.exec(args.expression);
    if (through) return { result: String(Number(through[1]) + 4), variablesReference: 0 };
    const read = /frame_stack\[(\d+)\]\.return_address_ptr/.exec(args.expression);
    if (read) {
      rig.returnAddressReads.push(read[1]);
      return { result: (RETURN_ADDRESS + BigInt(rig.controlReturns ? Number(read[1]) : 0)).toString(), variablesReference: 0 };
    }
    if (args.expression.includes('GetNumLineEntries')) {
      const address = /ResolveLoadAddress\((\d+)\)/.exec(args.expression);
      return { result: String(address ? rig.controlReturns?.[Number(BigInt(address[1]) - RETURN_ADDRESS)] ?? 0 : rig.cLine ?? 0), variablesReference: 0 };
    }
    if (args.expression.startsWith('/py ') && args.expression.includes('ResolveLoadAddress')) {
      // The return address sits in the generated C of the PERFORM at hello.cob:32 (line map row 127 -> 32).
      return { result: `'${HELLO_C.replace(/\\/g, '\\\\')}|130'`, variablesReference: 0 };
    }
    throw new Error(`unexpected evaluate ${args.expression}`);
  });
  const advance = (command: string, list: Stop[]) => () => {
    rig.commands.push(command);
    const stop = list.length > 1 ? list.shift()! : list[0];
    if (!stop) {
      throw new Error(`no scripted stop for ${command}`);
    }
    rig.position = stop.frame;
    rig.cLine = stop.cLine;
    if (stop.depth !== undefined) {
      rig.depth = stop.depth;
    }
    const body = { reason: 'step', threadId: 1, allThreadsStopped: true, ...(stop.stopped ?? {}) };
    setImmediate(() => engine.emit('stopped', body));
    return {};
  };
  engine.on('next', advance('next', rig.nextStops));
  engine.on('stepIn', advance('stepIn', rig.nextStops));
  engine.on('stepOut', advance('stepOut', rig.nextStops));
  engine.on('continue', advance('continue', rig.continueStops));
  return rig;
}

const returnHit = (): Partial<DebugProtocol.StoppedEvent['body']> => ({ reason: 'breakpoint', hitBreakpointIds: [INSTRUCTION_ID] });
const armed = (rig: Rig): string[] => rig.instructionSends.map((s) => s.breakpoints.map((b) => b.instructionReference).join(','));

describe('cobol shim PERFORM-aware stepping', () => {
  let h: Harness | undefined;

  afterEach(async () => {
    await h?.cleanup();
    h = undefined;
  });

  it('next on a PERFORM: the walk lands deeper, the range runs to its armed return, the walk goes on to the next statement', async () => {
    let rig!: Rig;
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => { rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 32), 0); } });
    await bringUp(h);
    rig.nextStops.push(
      { frame: frame(1, 'HELLO_', HELLO_C, 127) },
      { frame: frame(1, 'HELLO_', HELLO_COB, 37), depth: 1 },
      // after the return stop: the generated C after the goto, then the next statement at depth 0
      { frame: frame(1, 'HELLO_', HELLO_C, 141) },
      { frame: frame(1, 'HELLO_', HELLO_COB, 33), depth: 0 }
    );
    rig.continueStops.push({ frame: frame(1, 'HELLO_', HELLO_C, 140), depth: 1, stopped: returnHit() });

    const response = await h.client.request('next', { threadId: 1 });
    expect(response.success).toBe(true);
    expect(response.command).toBe('next');
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'step', threadId: 1, description: 'stepped over the PERFORM at hello.cob:32' });
    expect(stopped.body).not.toHaveProperty('hitBreakpointIds');
    await tick(30);
    expect(h.client.events('stopped')).toHaveLength(1);
    expect(h.client.events('continued')).toHaveLength(0);
    expect(rig.commands).toEqual(['next', 'next', 'continue', 'next', 'next']);
    // The return of the entry just pushed (frame_stack[1]) was armed, then dropped.
    expect(rig.returnAddressReads).toEqual(['1']);
    expect(armed(rig)).toEqual(['0x7ff6e194181e', '']);
    expect(rig.breakpointSends).toHaveLength(0);
    const frames = ((await h.client.request('stackTrace', { threadId: 1 })).body as DebugProtocol.StackTraceResponse['body']).stackFrames;
    expect(frames[0].line).toBe(33);
  });

  it('next on an ordinary statement reads the depth and lands as before: no return stop, no description', async () => {
    let rig!: Rig;
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => { rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 37), 1); } });
    await bringUp(h);
    rig.nextStops.push({ frame: frame(1, 'HELLO_', HELLO_C, 210) }, { frame: frame(1, 'HELLO_', HELLO_COB, 38) });
    await h.client.request('next', { threadId: 1 });
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'step' });
    expect(stopped.body).not.toHaveProperty('description');
    expect(rig.commands).toEqual(['next', 'next']);
    expect(rig.instructionSends).toHaveLength(0);
    expect(h.engine.received('evaluate').map((r) => (r.arguments as { expression: string }).expression)).toEqual([DEPTH_EXPRESSION, DEPTH_EXPRESSION]);
  });

  it('a user breakpoint inside the performed range ends the step as a breakpoint stop, the return stop dropped', async () => {
    let rig!: Rig;
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => { rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 32), 0); } });
    await bringUp(h);
    await h.client.request('setBreakpoints', { source: { path: HELLO_COB }, breakpoints: [{ line: 39 }] });
    rig.nextStops.push({ frame: frame(1, 'HELLO_', HELLO_C, 127) }, { frame: frame(1, 'HELLO_', HELLO_COB, 37), depth: 1 });
    rig.continueStops.push({ frame: frame(1, 'HELLO_', HELLO_COB, 39), depth: 1, stopped: { reason: 'breakpoint', hitBreakpointIds: [1] } });

    await h.client.request('next', { threadId: 1 });
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'breakpoint', hitBreakpointIds: [1] });
    expect(rig.commands).toEqual(['next', 'next', 'continue']);
    expect(armed(rig)).toEqual(['0x7ff6e194181e', '']);
  });

  it('stepOut inside a performed paragraph runs to its armed return and walks to the next statement at a shallower depth', async () => {
    let rig!: Rig;
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => { rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 37), 1); } });
    await bringUp(h);
    rig.continueStops.push({ frame: frame(1, 'HELLO_', HELLO_C, 140), depth: 1, stopped: returnHit() });
    rig.nextStops.push({ frame: frame(1, 'HELLO_', HELLO_C, 141) }, { frame: frame(1, 'HELLO_', HELLO_COB, 33), depth: 0 });

    const response = await h.client.request('stepOut', { threadId: 1 });
    expect(response.success).toBe(true);
    expect(response.command).toBe('stepOut');
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'step', description: 'returned from 1000-INIT to 0000-MAIN' });
    expect(rig.commands).toEqual(['continue', 'next', 'next']);
    expect(rig.returnAddressReads).toEqual(['1']);
    expect(armed(rig)).toEqual(['0x7ff6e194181e', '']);
    await tick(30);
    expect(h.client.events('stopped')).toHaveLength(1);
  });

  it('stepOut from a paragraph performed 3 TIMES re-arms the return at each re-entry and lands after the last iteration', async () => {
    let rig!: Rig;
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => { rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 37), 1); } });
    await bringUp(h);
    rig.continueStops.push({ frame: frame(1, 'HELLO_', HELLO_C, 140), depth: 1, stopped: returnHit() });
    // Each walk after a return re-enters the paragraph at its first statement (depth 1) twice, then lands at depth 0.
    rig.nextStops.push(
      { frame: frame(1, 'HELLO_', HELLO_C, 141) }, { frame: frame(1, 'HELLO_', HELLO_COB, 37), depth: 1 },
      { frame: frame(1, 'HELLO_', HELLO_C, 141) }, { frame: frame(1, 'HELLO_', HELLO_COB, 37), depth: 1 },
      { frame: frame(1, 'HELLO_', HELLO_C, 141) }, { frame: frame(1, 'HELLO_', HELLO_COB, 33), depth: 0 }
    );

    await h.client.request('stepOut', { threadId: 1 });
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'step', description: 'returned from 1000-INIT to 0000-MAIN (3 times through the performed range)' });
    expect(rig.commands).toEqual(['continue', 'next', 'next', 'continue', 'next', 'next', 'continue', 'next', 'next']);
    // The origin line (37) is a real landing when walking from a return, and the entry is re-read every time.
    expect(rig.returnAddressReads).toEqual(['1', '1', '1']);
    expect(armed(rig)).toEqual(['0x7ff6e194181e', '', '0x7ff6e194181e', '', '0x7ff6e194181e', '']);
    const frames = ((await h.client.request('stackTrace', { threadId: 1 })).body as DebugProtocol.StackTraceResponse['body']).stackFrames;
    expect(frames[0].line).toBe(33);
  });

  it('next on a PERFORM that ends a performed paragraph: the walk after the inner return leaves the outer range too', async () => {
    let rig!: Rig;
    // Paused on `PERFORM 3100-INNER` at depth 1 (inside 3000-OUTER); the hello fixture stands in for the shape.
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => { rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 38), 1); } });
    await bringUp(h);
    rig.nextStops.push(
      { frame: frame(1, 'HELLO_', HELLO_C, 220) },
      { frame: frame(1, 'HELLO_', HELLO_COB, 39), depth: 2 },
      // after the inner return: the outer paragraph's own return code, then the performer's next statement at depth 0
      { frame: frame(1, 'HELLO_', HELLO_C, 240) },
      { frame: frame(1, 'HELLO_', HELLO_COB, 34), depth: 0 }
    );
    rig.continueStops.push({ frame: frame(1, 'HELLO_', HELLO_C, 236), depth: 2, stopped: returnHit() });

    await h.client.request('next', { threadId: 1 });
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'step', description: 'stepped over the PERFORM at hello.cob:38' });
    expect(rig.returnAddressReads).toEqual(['2']);
    const frames = ((await h.client.request('stackTrace', { threadId: 1 })).body as DebugProtocol.StackTraceResponse['body']).stackFrames;
    expect(frames[0].line).toBe(34);
  });

  it('next on `PERFORM … UNTIL` (cobc 3.2): the loop test on the PERFORM\'s own line is not a landing while walking from a return', async () => {
    let rig!: Rig;
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => { rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 32), 0); } });
    await bringUp(h);
    rig.nextStops.push(
      { frame: frame(1, 'HELLO_', HELLO_C, 127) },
      { frame: frame(1, 'HELLO_', HELLO_COB, 37), depth: 1 },
      // after the first return: the UNTIL test, attributed to the PERFORM's line, at depth 0 — then the range again
      { frame: frame(1, 'HELLO_', HELLO_COB, 32), depth: 0 },
      { frame: frame(1, 'HELLO_', HELLO_COB, 37), depth: 1 },
      // after the second return: the test again, then the loop exits to the next statement
      { frame: frame(1, 'HELLO_', HELLO_COB, 32), depth: 0 },
      { frame: frame(1, 'HELLO_', HELLO_COB, 33), depth: 0 }
    );
    rig.continueStops.push({ frame: frame(1, 'HELLO_', HELLO_C, 140), depth: 1, stopped: returnHit() });

    await h.client.request('next', { threadId: 1 });
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'step', description: 'stepped over the PERFORM at hello.cob:32 (2 times through the performed range)' });
    expect(rig.commands).toEqual(['next', 'next', 'continue', 'next', 'next', 'continue', 'next', 'next']);
    const frames = ((await h.client.request('stackTrace', { threadId: 1 })).body as DebugProtocol.StackTraceResponse['body']).stackFrames;
    expect(frames[0].line).toBe(33);
  });

  it('stepOut from a paragraph performed UNTIL (cobc 3.2) runs through the loop test on the PERFORM\'s line to the statement after it', async () => {
    let rig!: Rig;
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => { rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 37), 1); } });
    await bringUp(h);
    rig.continueStops.push({ frame: frame(1, 'HELLO_', HELLO_C, 140), depth: 1, stopped: returnHit() });
    rig.nextStops.push(
      { frame: frame(1, 'HELLO_', HELLO_COB, 32), depth: 0 },
      { frame: frame(1, 'HELLO_', HELLO_COB, 37), depth: 1 },
      { frame: frame(1, 'HELLO_', HELLO_COB, 32), depth: 0 },
      { frame: frame(1, 'HELLO_', HELLO_COB, 33), depth: 0 }
    );
    await h.client.request('stepOut', { threadId: 1 });
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'step', description: 'returned from 1000-INIT to 0000-MAIN (2 times through the performed range)' });
    // The PERFORM's line was resolved from the return address before the first continue.
    expect(h.engine.received('evaluate').some((r) => (r.arguments as { expression: string }).expression.includes('ResolveLoadAddress'))).toBe(true);
    expect(rig.commands).toEqual(['continue', 'next', 'next', 'continue', 'next', 'next']);
    const frames = ((await h.client.request('stackTrace', { threadId: 1 })).body as DebugProtocol.StackTraceResponse['body']).stackFrames;
    expect(frames[0].line).toBe(33);
  });

  it('a resume refused right after a return hit surfaces the stop as a step without the shim\'s own breakpoint id', async () => {
    let rig!: Rig;
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => { rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 37), 1); } });
    await bringUp(h);
    rig.continueStops.push({ frame: frame(1, 'HELLO_', HELLO_C, 140), depth: 1, stopped: returnHit() });
    h.engine.on('next', () => {
      throw new Error('Process is exiting');
    });
    await h.client.request('stepOut', { threadId: 1 });
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'step' });
    expect(stopped.body).not.toHaveProperty('hitBreakpointIds');
    expect((stopped.body as DebugProtocol.StoppedEvent['body']).description).toMatch(/step loop stopped early/);
    expect(armed(rig)).toEqual(['0x7ff6e194181e', '']);
  });

  it('stepOut outside any PERFORM is the engine\'s stepOut (leaving the program), not a plan', async () => {
    let rig!: Rig;
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => { rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 33), 0); } });
    await bringUp(h);
    rig.nextStops.push({ frame: frame(2, 'main', HELLO_C, 40) });
    await h.client.request('stepOut', { threadId: 1 });
    await h.client.nextEvent('stopped');
    expect(rig.commands).toEqual(['stepOut']);
    expect(rig.instructionSends).toHaveLength(0);
  });

  it('a client continue while the range runs drops the return stop before it goes to the engine; a pause surfaces as a pause', async () => {
    let rig!: Rig;
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => { rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 37), 1); } });
    await bringUp(h);
    // The range never returns (a long PERFORM UNTIL); the client gives up and continues itself.
    h.engine.on('continue', () => {
      rig.commands.push('continue');
      return {};
    });
    await h.client.request('stepOut', { threadId: 1 });
    await tick(30);
    expect(armed(rig)).toEqual(['0x7ff6e194181e']);
    const response = await h.client.request('continue', { threadId: 1 });
    expect(response.success).toBe(true);
    expect(rig.commands).toEqual(['continue', 'continue']);
    expect(armed(rig)).toEqual(['0x7ff6e194181e', '']);
    rig.position = frame(1, 'HELLO_', HELLO_COB, 39);
    h.engine.emit('stopped', { reason: 'pause', threadId: 1, allThreadsStopped: true });
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'pause' });
  });

  it('a pause answered while the range runs ends the step as a pause and drops the return stop', async () => {
    let rig!: Rig;
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => { rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 37), 1); } });
    await bringUp(h);
    rig.continueStops.push({ frame: frame(1, 'HELLO_', HELLO_COB, 39), depth: 1, stopped: { reason: 'pause' } });
    await h.client.request('stepOut', { threadId: 1 });
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'pause' });
    expect(armed(rig)).toEqual(['0x7ff6e194181e', '']);
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
    expect(rig.instructionSends).toHaveLength(0);
  });

  it.each([
    ['next', HELLO_COB], ['stepOut', HELLO_COB],
    ['next', HELLO_COB.replace(/\\/g, '/').toUpperCase()]
  ])('%s stops at a GO TO destination (%s) without waiting for a return that will never run', async (command, destination) => {
    const manifest = helloWithStatements();
    manifest.programs[0].procedure.statements.push({ sourceFileId: 1, line: 41, verb: 'MOVE' });
    manifest.programs[0].controlFlow = {
      hasGoto: true,
      ranges: [{ labelId: 5, startCLine: 200, endCLine: 249 }],
      performs: [{ callCLine: 127, returnCLine: 140, endCLine: 149, startLabel: 5, endLabel: 5 }]
    };
    let rig!: Rig;
    h = await startShim({ manifests: [manifest], engineSetup: engine => {
      rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, command === 'next' ? 32 : 37), command === 'next' ? 0 : 1);
      rig.controlReturns = { 1: 141 };
    } });
    await bringUp(h);
    rig.nextStops.push(
      { frame: frame(1, 'HELLO_', HELLO_COB, 37), depth: 1, cLine: 210 },
      { frame: frame(1, 'HELLO_', HELLO_COB, 38), depth: 1, cLine: 220 },
      { frame: frame(1, 'HELLO_', destination, 41), depth: 1, cLine: 310 }
    );
    await h.client.request(command, { threadId: 1 });
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'step', description: expect.stringMatching(/GO TO left the active PERFORM range; stopped at hello\.cob:41/i) });
    expect(rig.commands).toEqual(['next', 'next', 'next']);
    expect(rig.instructionSends).toEqual([]);
  });

  it('distinguishes the destination from a repeated COPY source line, even when stepOut began on that same line', async () => {
    const manifest = helloWithStatements();
    manifest.programs[0].controlFlow = {
      hasGoto: true, ranges: [{ labelId: 5, startCLine: 200, endCLine: 249 }],
      performs: [{ callCLine: 127, returnCLine: 140, endCLine: 149, startLabel: 5, endLabel: 5 }]
    };
    let rig!: Rig;
    h = await startShim({ manifests: [manifest], engineSetup: engine => {
      rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 37), 1);
      rig.controlReturns = { 1: 141 };
    } });
    await bringUp(h);
    rig.nextStops.push(
      { frame: frame(1, 'HELLO_', HELLO_COB, 37), depth: 1, cLine: 210 },
      { frame: frame(1, 'HELLO_', HELLO_COB, 37), depth: 1, cLine: 310 }
    );
    await h.client.request('stepOut', { threadId: 1 });
    expect((await h.client.nextEvent('stopped')).body).toMatchObject({ reason: 'step', description: expect.stringContaining('GO TO left') });
    expect(rig.commands).toEqual(['next', 'next']);
  });

  it('keeps a nested PERFORM outside the outer range running and recognizes a normal return before the depth pop', async () => {
    const manifest = helloWithStatements();
    manifest.programs[0].procedure.statements.push({ sourceFileId: 1, line: 41, verb: 'MOVE' });
    manifest.programs[0].controlFlow = {
      hasGoto: true, ranges: [{ labelId: 5, startCLine: 200, endCLine: 249 }, { labelId: 6, startCLine: 300, endCLine: 349 }],
      performs: [
        { callCLine: 127, returnCLine: 140, endCLine: 149, startLabel: 5, endLabel: 5 },
        { callCLine: 220, returnCLine: 230, endCLine: 235, startLabel: 6, endLabel: 6 }
      ]
    };
    let rig!: Rig;
    h = await startShim({ manifests: [manifest], engineSetup: engine => {
      rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 32), 0);
      rig.controlReturns = { 1: 141, 2: 231 };
    } });
    await bringUp(h);
    rig.nextStops.push(
      { frame: frame(1, 'HELLO_', HELLO_COB, 37), depth: 1, cLine: 210 },
      { frame: frame(1, 'HELLO_', HELLO_COB, 38), depth: 2, cLine: 222 },
      { frame: frame(1, 'HELLO_', HELLO_COB, 41), depth: 2, cLine: 310 },
      { frame: frame(1, 'HELLO_', HELLO_COB, 38), depth: 2, cLine: 231 },
      { frame: frame(1, 'HELLO_', HELLO_COB, 39), depth: 1, cLine: 240 },
      { frame: frame(1, 'HELLO_', HELLO_COB, 33), depth: 0, cLine: 151 }
    );
    await h.client.request('next', { threadId: 1 });
    expect((await h.client.nextEvent('stopped')).body?.reason).toBe('step');
    expect(rig.position.line).toBe(33);
    expect(rig.commands).toEqual(Array(6).fill('next'));
  });

  it('surfaces an honest single-statement fallback for old GO TO manifests without range identities', async () => {
    const manifest = helloWithStatements();
    manifest.programs[0].procedure.statements.push({ sourceFileId: 1, line: 39, verb: 'GO TO' });
    let rig!: Rig;
    h = await startShim({ manifests: [manifest], engineSetup: engine => { rig = rigEngine(engine, frame(1, 'HELLO_', HELLO_COB, 32), 0); } });
    await bringUp(h);
    rig.nextStops.push({ frame: frame(1, 'HELLO_', HELLO_COB, 37), depth: 1 });
    await h.client.request('next', { threadId: 1 });
    expect((await h.client.nextEvent('stopped')).body?.description).toContain('metadata or PC location unavailable');
    expect(rig.commands).toEqual(['next']);
    expect(rig.instructionSends).toEqual([]);
  });

});

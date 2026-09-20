/**
 * Logpoints (milestone M3): a `logMessage` never reaches the engine (its own
 * `{…}` parser aborts the adapter on a COBOL name, measured); the shim sets a
 * plain breakpoint, interpolates `{WS-NAME}` with its COBOL evaluator at the
 * stop, emits the text as an `output` event and resumes, so the client never
 * sees the stop. A pausing breakpoint on the same stop logs and pauses.
 */
import { describe, expect, it, afterEach } from 'vitest';
import path from 'node:path';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { installMemory } from './fake-engine.js';
import { helloManifest, helloMemory } from './fixtures.js';
import { bringUp, frame, startShim, tick, type Harness } from './harness.js';

const ROOT = path.resolve('/work/cobol/examples');
const HELLO_COB = path.join(ROOT, 'hello.cob');

interface Rig {
  sends: DebugProtocol.SetBreakpointsArguments[];
  commands: string[];
}

function rig(h: Harness, position: DebugProtocol.StackFrame): Rig {
  const out: Rig = { sends: [], commands: [] };
  const ids = new Map<number, number>();
  let next = 1;
  h.engine.on('setBreakpoints', (args: DebugProtocol.SetBreakpointsArguments) => {
    out.sends.push(args);
    return {
      breakpoints: (args.breakpoints ?? []).map((bp) => {
        if (!ids.has(bp.line)) {
          ids.set(bp.line, next++);
        }
        return { id: ids.get(bp.line), line: bp.line, verified: true };
      })
    };
  });
  h.engine.on('stackTrace', () => ({ stackFrames: [{ ...position, source: position.source ? { ...position.source } : undefined }], totalFrames: 1 }));
  h.engine.on('continue', () => {
    out.commands.push('continue');
    setImmediate(() => h.engine.emit('continued', { threadId: 1, allThreadsContinued: true }));
    return { allThreadsContinued: true };
  });
  return out;
}

describe('cobol shim logpoints', () => {
  let h: Harness | undefined;

  afterEach(async () => {
    await h?.cleanup();
    h = undefined;
  });

  it('strips logMessage before the engine, logs the interpolated message at the hit and resumes without a client stop', async () => {
    h = await startShim({ manifests: [helloManifest(ROOT)], engineSetup: (engine) => installMemory(engine, helloMemory()) });
    await bringUp(h);
    const r = rig(h, frame(1, 'HELLO_', HELLO_COB, 32));
    const set = await h.client.request('setBreakpoints', {
      source: { path: HELLO_COB },
      breakpoints: [{ line: 32, logMessage: 'scaled={WS-SCALED} id={WS-ID OF WS-GROUP} status={WS-STATUS-ACTIVE} raw={/nat 1+1}' }]
    });
    expect((set.body as DebugProtocol.SetBreakpointsResponse['body']).breakpoints).toEqual([{ id: 1, line: 32, verified: true }]);
    expect(r.sends[0].breakpoints).toEqual([{ line: 32 }]);

    // `/nat` goes to the engine as-is; every other evaluate is the memory reader's (installMemory).
    const memoryEvaluate = h.engine.handler('evaluate')!;
    h.engine.on('evaluate', (args: { expression: string }, request) => {
      if (args.expression === '/nat 1+1') {
        return { result: '2', variablesReference: 0 };
      }
      return memoryEvaluate(args, request);
    });
    h.engine.emit('stopped', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true, hitBreakpointIds: [1] });
    const output = await h.client.nextEvent('output');
    expect(output.body).toEqual({ category: 'console', output: 'scaled=-123.45 id=42 status=true raw=2\n' });
    await tick(50);
    expect(h.client.events('stopped')).toHaveLength(0);
    expect(h.client.events('continued')).toHaveLength(0);
    expect(r.commands).toEqual(['continue']);
  });

  it('a pausing breakpoint on the same stop logs and pauses, reporting only the pausing id', async () => {
    h = await startShim({ manifests: [helloManifest(ROOT)], engineSetup: (engine) => installMemory(engine, helloMemory()) });
    await bringUp(h);
    const r = rig(h, frame(1, 'HELLO_', HELLO_COB, 32));
    await h.client.request('setBreakpoints', {
      source: { path: HELLO_COB },
      breakpoints: [{ line: 32, logMessage: 'at 32' }, { line: 33 }]
    });
    // The engine reports both lines hit (a stop that covers a logpoint line and a pausing line).
    h.engine.emit('stopped', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true, hitBreakpointIds: [1, 2] });
    const output = await h.client.nextEvent('output');
    expect(output.body).toMatchObject({ output: 'at 32\n' });
    const stopped = await h.client.nextEvent('stopped');
    expect((stopped.body as DebugProtocol.StoppedEvent['body']).hitBreakpointIds).toEqual([1, 2]);
    expect(r.commands).toEqual([]);
  });

  it('renders an unknown name and a failed engine expression inline instead of failing the logpoint', async () => {
    h = await startShim({ manifests: [helloManifest(ROOT)], engineSetup: (engine) => installMemory(engine, helloMemory()) });
    await bringUp(h);
    rig(h, frame(1, 'HELLO_', HELLO_COB, 32));
    await h.client.request('setBreakpoints', { source: { path: HELLO_COB }, breakpoints: [{ line: 32, logMessage: 'x={WS-NOPE} y={/nat boom} {not closed' }] });
    h.engine.on('evaluate', () => {
      throw new Error('boom failed');
    });
    h.engine.emit('stopped', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true, hitBreakpointIds: [1] });
    const output = await h.client.nextEvent('output');
    const text = (output.body as DebugProtocol.OutputEvent['body']).output;
    expect(text).toMatch(/^x=<unavailable: .*WS-NOPE.*> y=<unavailable: boom failed> \{not closed\n$/);
  });

  it('a step that lands on a logpoint line logs it and lands there, as a step', async () => {
    h = await startShim({ manifests: [helloManifest(ROOT)], engineSetup: (engine) => installMemory(engine, helloMemory()) });
    await bringUp(h);
    const harness = h;
    let position = frame(1, 'HELLO_', HELLO_COB, 32);
    const commands: string[] = [];
    harness.engine.on('setBreakpoints', (args: DebugProtocol.SetBreakpointsArguments) => ({
      breakpoints: (args.breakpoints ?? []).map((bp) => ({ id: bp.line, line: bp.line, verified: true }))
    }));
    harness.engine.on('stackTrace', () => ({ stackFrames: [{ ...position, source: { ...position.source! } }], totalFrames: 1 }));
    // The engine reports a step that ends on an enabled breakpoint site as a breakpoint hit.
    const stops: Array<{ frame: DebugProtocol.StackFrame; body?: Partial<DebugProtocol.StoppedEvent['body']> }> = [
      { frame: frame(1, 'HELLO_', path.join(ROOT, 'build', 'hello.c'), 127) },
      { frame: frame(1, 'HELLO_', HELLO_COB, 33), body: { reason: 'breakpoint', hitBreakpointIds: [33] } },
      { frame: frame(1, 'HELLO_', HELLO_COB, 34) }
    ];
    harness.engine.on('next', () => {
      commands.push('next');
      const stop = stops.shift()!;
      position = stop.frame;
      setImmediate(() => harness.engine.emit('stopped', { reason: 'step', threadId: 1, allThreadsStopped: true, ...stop.body }));
      return {};
    });
    await h.client.request('setBreakpoints', { source: { path: HELLO_COB }, breakpoints: [{ line: 33, logMessage: 'passing 33' }] });

    await h.client.request('next', { threadId: 1 });
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'step' });
    expect(stopped.body).not.toHaveProperty('hitBreakpointIds');
    expect(h.client.events('output').map((e) => (e.body as DebugProtocol.OutputEvent['body']).output)).toEqual(['passing 33\n']);
    expect(commands).toEqual(['next', 'next']);
    const frames = ((await h.client.request('stackTrace', { threadId: 1 })).body as DebugProtocol.StackTraceResponse['body']).stackFrames;
    expect(frames[0].line).toBe(33);
  });

  it('a stop that answers a client pause on a logpoint line is a pause: not logged again, not resumed', async () => {
    h = await startShim({ manifests: [helloManifest(ROOT)], engineSetup: (engine) => installMemory(engine, helloMemory()) });
    await bringUp(h);
    const r = rig(h, frame(1, 'HELLO_', HELLO_COB, 32));
    await h.client.request('setBreakpoints', { source: { path: HELLO_COB }, breakpoints: [{ line: 32, logMessage: 'at 32' }] });
    // A pause on a stopped process: CodeLLDB answers and re-reports the current stop (review of #764).
    h.engine.on('pause', () => {
      setImmediate(() => h!.engine.emit('stopped', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true, hitBreakpointIds: [1] }));
      return {};
    });
    const response = await h.client.request('pause', { threadId: 1 });
    expect(response.success).toBe(true);
    const stopped = await h.client.nextEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'pause', description: 'Paused (on a logpoint line)' });
    expect(stopped.body).not.toHaveProperty('hitBreakpointIds');
    await tick(30);
    expect(h.client.events('output')).toHaveLength(0);
    expect(r.commands).toEqual([]);
  });

  it('a logpoint sharing its line with a pausing breakpoint logs and pauses', async () => {
    h = await startShim({ manifests: [helloManifest(ROOT)], engineSetup: (engine) => installMemory(engine, helloMemory()) });
    await bringUp(h);
    const r = rig(h, frame(1, 'HELLO_', HELLO_COB, 32));
    const set = await h.client.request('setBreakpoints', {
      source: { path: HELLO_COB },
      breakpoints: [{ line: 32, logMessage: 'scaled={WS-SCALED}' }, { line: 32 }]
    });
    // One engine entry for the line; both client entries answered from it.
    expect(r.sends[0].breakpoints).toEqual([{ line: 32 }]);
    expect((set.body as DebugProtocol.SetBreakpointsResponse['body']).breakpoints.map((bp) => bp.id)).toEqual([1, 1]);
    h.engine.emit('stopped', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true, hitBreakpointIds: [1] });
    const output = await h.client.nextEvent('output');
    expect(output.body).toMatchObject({ output: 'scaled=-123.45\n' });
    const stopped = await h.client.nextEvent('stopped');
    expect((stopped.body as DebugProtocol.StoppedEvent['body']).hitBreakpointIds).toEqual([1]);
    expect(r.commands).toEqual([]);
  });
});

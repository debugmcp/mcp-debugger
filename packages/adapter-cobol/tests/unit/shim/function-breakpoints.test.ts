/**
 * COBOL function breakpoints (milestone M3): a paragraph, section or PROGRAM-ID
 * name becomes a source breakpoint on the range's first statement, sent in the
 * union with the client's own line breakpoints of that file, reported under a
 * shim id, with hits and `breakpoint` events translated; C symbols still go to
 * the engine as function breakpoints.
 */
import { describe, expect, it, afterEach } from 'vitest';
import path from 'node:path';
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { CobolManifest } from '../../../src/manifest/schema.js';
import { FUNCTION_BP_ID_BASE } from '../../../src/shim/breakpoint-table.js';
import type { FakeEngine } from './fake-engine.js';
import { callsManifest, helloManifest } from './fixtures.js';
import { bringUp, frame, startShim, tick, type Harness } from './harness.js';

const ROOT = path.resolve('/work/cobol/examples');
const HELLO_COB = path.join(ROOT, 'hello.cob');
const MAIN_COB = path.join(ROOT, 'calls', 'main.cob');

/** hello with a statement list: 0000-MAIN 32-35, 1000-INIT 37-40 (36 is the header). */
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

/** CodeLLDB-shaped: one id per line, stable across sends, `verified` unless the line is 999. */
function codelldbBreakpoints(engine: FakeEngine): { sends: DebugProtocol.SetBreakpointsArguments[] } {
  const sends: DebugProtocol.SetBreakpointsArguments[] = [];
  const ids = new Map<string, number>();
  let next = 1;
  engine.on('setBreakpoints', (args: DebugProtocol.SetBreakpointsArguments) => {
    sends.push(args);
    return {
      breakpoints: (args.breakpoints ?? []).map((bp) => {
        const key = `${args.source.path}:${bp.line}`;
        if (!ids.has(key)) {
          ids.set(key, next++);
        }
        return { id: ids.get(key), line: bp.line, verified: bp.line !== 999, message: bp.line === 999 ? 'Resolved locations: 0' : undefined };
      })
    };
  });
  engine.on('setFunctionBreakpoints', (args: DebugProtocol.SetFunctionBreakpointsArguments) => ({
    breakpoints: args.breakpoints.map((bp, i) => ({ id: 500 + i, verified: bp.name !== 'nowhere' }))
  }));
  return { sends };
}

describe('cobol shim function breakpoints', () => {
  let h: Harness | undefined;

  afterEach(async () => {
    await h?.cleanup();
    h = undefined;
  });

  it('resolves a paragraph name to its first statement, sends it with the file union and answers under a shim id', async () => {
    let sends: DebugProtocol.SetBreakpointsArguments[] = [];
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => ({ sends } = codelldbBreakpoints(engine)) });
    await bringUp(h);
    // The client's own line breakpoint on the file first.
    const lines = await h.client.request('setBreakpoints', { source: { path: HELLO_COB }, breakpoints: [{ line: 33 }] });
    expect((lines.body as DebugProtocol.SetBreakpointsResponse['body']).breakpoints).toEqual([{ id: 1, line: 33, verified: true }]);

    const response = await h.client.request('setFunctionBreakpoints', { breakpoints: [{ name: '1000-INIT' }] });
    expect(response.success).toBe(true);
    const [fn] = (response.body as DebugProtocol.SetFunctionBreakpointsResponse['body']).breakpoints;
    expect(fn.id).toBe(FUNCTION_BP_ID_BASE);
    expect(fn.verified).toBe(true);
    expect(fn.line).toBe(37);
    expect(fn.source?.path).toBe(HELLO_COB);
    expect(fn.message).toBe('1000-INIT (paragraph of HELLO) -> hello.cob:37');
    // The union re-sent for the file: the client's line, then the paragraph's first statement.
    const last = sends[sends.length - 1];
    expect(last.source.path).toBe(HELLO_COB);
    expect(last.breakpoints).toEqual([{ line: 33 }, { line: 37 }]);
    // Nothing went to the engine as a function breakpoint (the hook is not armed).
    expect(h.engine.received('setFunctionBreakpoints')[0].arguments).toEqual({ breakpoints: [] });
  });

  it('a hit on the paragraph line reports the shim id; a hit on a line the client also has reports both', async () => {
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => void codelldbBreakpoints(engine) });
    await bringUp(h);
    await h.client.request('setBreakpoints', { source: { path: HELLO_COB }, breakpoints: [{ line: 37 }] });
    await h.client.request('setFunctionBreakpoints', { breakpoints: [{ name: '1000-INIT' }, { name: '0000-MAIN' }] });
    // Line 37 was sent once (id 1) even though the client and 1000-INIT both want it; 0000-MAIN's first statement is 32 (id 2).
    const setSends = h.engine.received('setBreakpoints');
    const lastArgs = setSends[setSends.length - 1].arguments as DebugProtocol.SetBreakpointsArguments;
    expect(lastArgs.breakpoints).toEqual([{ line: 37 }, { line: 32 }]);

    h.engine.on('stackTrace', () => ({ stackFrames: [frame(1, 'HELLO_', HELLO_COB, 37)], totalFrames: 1 }));
    h.engine.emit('stopped', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true, hitBreakpointIds: [1] });
    const both = await h.client.nextEvent('stopped');
    expect((both.body as DebugProtocol.StoppedEvent['body']).hitBreakpointIds).toEqual([1, FUNCTION_BP_ID_BASE]);

    h.engine.emit('stopped', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true, hitBreakpointIds: [2] });
    await tick(20);
    const only = h.client.events('stopped')[1];
    expect((only.body as DebugProtocol.StoppedEvent['body']).hitBreakpointIds).toEqual([FUNCTION_BP_ID_BASE + 1]);
  });

  it('mirrors a breakpoint event for a function-only line under the shim id and drops the engine id', async () => {
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => void codelldbBreakpoints(engine) });
    await bringUp(h);
    await h.client.request('setFunctionBreakpoints', { breakpoints: [{ name: '1000-INIT' }] });
    h.engine.emit('breakpoint', { reason: 'changed', breakpoint: { id: 1, line: 37, verified: true, message: 'Resolved locations: 1' } });
    const event = await h.client.nextEvent('breakpoint');
    expect(event.body).toEqual({ reason: 'changed', breakpoint: { id: FUNCTION_BP_ID_BASE, line: 37, verified: true, message: 'Resolved locations: 1' } });
    await tick(20);
    expect(h.client.events('breakpoint')).toHaveLength(1);
  });

  it('keeps the client order: a C symbol goes to the engine, an unknown COBOL name fails with a message, a PROGRAM-ID binds its first statement', async () => {
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => void codelldbBreakpoints(engine) });
    await bringUp(h);
    const response = await h.client.request('setFunctionBreakpoints', {
      breakpoints: [{ name: 'HELLO_' }, { name: '9999-NOWHERE' }, { name: 'HELLO' }, { name: 'nowhere' }]
    });
    const bps = (response.body as DebugProtocol.SetFunctionBreakpointsResponse['body']).breakpoints;
    expect(bps).toHaveLength(4);
    expect(bps[0]).toEqual({ id: 500, verified: true });
    expect(bps[1].verified).toBe(false);
    expect(bps[1].message).toMatch(/no paragraph, section or program named 9999-NOWHERE .*HELLO/);
    // Said out loud too: the launch warning is muted by the bind-late pin.
    const said = h.client.events('output').map((ev) => (ev.body as DebugProtocol.OutputEvent['body']).output);
    expect(said.some((line) => line.startsWith('COBOL function breakpoint "9999-NOWHERE": no paragraph'))).toBe(true);
    expect(bps[2]).toMatchObject({ id: FUNCTION_BP_ID_BASE, verified: true, line: 32, source: { path: HELLO_COB } });
    expect(bps[2].message).toBe('HELLO (program entry) -> hello.cob:32');
    expect(bps[3]).toEqual({ id: 501, verified: false });
    expect(h.engine.received('setFunctionBreakpoints')[0].arguments).toEqual({ breakpoints: [{ name: 'HELLO_' }, { name: 'nowhere' }] });
  });

  it('a later setBreakpoints for the file keeps the function line in the union and answers only the client entries', async () => {
    let sends: DebugProtocol.SetBreakpointsArguments[] = [];
    h = await startShim({ manifests: [helloWithStatements()], engineSetup: (engine) => ({ sends } = codelldbBreakpoints(engine)) });
    await bringUp(h);
    await h.client.request('setFunctionBreakpoints', { breakpoints: [{ name: '1000-INIT' }] });
    const response = await h.client.request('setBreakpoints', { source: { path: HELLO_COB }, breakpoints: [{ line: 32 }, { line: 34 }] });
    expect((response.body as DebugProtocol.SetBreakpointsResponse['body']).breakpoints).toEqual([
      { id: 2, line: 32, verified: true },
      { id: 3, line: 34, verified: true }
    ]);
    expect(sends[sends.length - 1].breakpoints).toEqual([{ line: 32 }, { line: 34 }, { line: 37 }]);
    // Clearing the function breakpoints drops the line from the union.
    await h.client.request('setFunctionBreakpoints', { breakpoints: [] });
    expect(sends[sends.length - 1].breakpoints).toEqual([{ line: 32 }, { line: 34 }]);
  });

  it('an ambiguous bare name asks for qualification; OF and colon forms pick the program', async () => {
    const hello = helloWithStatements();
    const other = helloWithStatements();
    other.programs[0].programId = 'PAYROLL';
    other.programs[0].cFunction = 'PAYROLL_';
    other.programs[0].cEntry = 'PAYROLL';
    other.sources[0].path = path.join(ROOT, 'payroll.cob');
    other.programs[0].generated = { c: path.join(ROOT, 'build', 'payroll.c') };
    h = await startShim({ manifests: [hello, other], engineSetup: (engine) => void codelldbBreakpoints(engine) });
    await bringUp(h);
    const response = await h.client.request('setFunctionBreakpoints', {
      breakpoints: [{ name: '1000-INIT' }, { name: '1000-INIT OF PAYROLL' }, { name: 'hello:1000-init' }]
    });
    const bps = (response.body as DebugProtocol.SetFunctionBreakpointsResponse['body']).breakpoints;
    expect(bps[0].verified).toBe(false);
    expect(bps[0].message).toMatch(/1000-INIT exists in HELLO and PAYROLL; qualify it/);
    expect(bps[1]).toMatchObject({ verified: true, line: 37, source: { path: path.join(ROOT, 'payroll.cob') } });
    expect(bps[2]).toMatchObject({ verified: true, line: 37, source: { path: HELLO_COB } });
  });

  it('a range without statements binds to its header line; a CALLed program resolves in its own file', async () => {
    h = await startShim({ manifests: [callsManifest(ROOT)], engineSetup: (engine) => void codelldbBreakpoints(engine) });
    await bringUp(h);
    const response = await h.client.request('setFunctionBreakpoints', { breakpoints: [{ name: 'CALLSUB' }] });
    const [bp] = (response.body as DebugProtocol.SetFunctionBreakpointsResponse['body']).breakpoints;
    expect(bp.verified).toBe(true);
    expect(bp.source?.path?.toLowerCase()).not.toBe(MAIN_COB.toLowerCase());
    expect(bp.message).toMatch(/^CALLSUB \(program entry\) -> sub\.cob:\d+$/);
  });

  it('resolves names with underscores in the manifests first, refuses a same-program duplicate, and carries a condition', async () => {
    const manifest = helloWithStatements();
    const program = manifest.programs[0];
    program.procedure.sections = [
      { name: 'IN_SEC', kind: 'section', sourceFileId: 1, startLine: 31, endLine: 35 },
      { name: 'OUT_SEC', kind: 'section', sourceFileId: 1, startLine: 36, endLine: 40 }
    ];
    program.procedure.paragraphs = [
      { name: '100-EXIT', kind: 'paragraph', sectionName: 'IN_SEC', sourceFileId: 1, startLine: 31, endLine: 35 },
      { name: '100-EXIT', kind: 'paragraph', sectionName: 'OUT_SEC', sourceFileId: 1, startLine: 36, endLine: 40 }
    ];
    let sends: DebugProtocol.SetBreakpointsArguments[] = [];
    h = await startShim({ manifests: [manifest], engineSetup: (engine) => ({ sends } = codelldbBreakpoints(engine)) });
    await bringUp(h);
    const response = await h.client.request('setFunctionBreakpoints', {
      breakpoints: [{ name: 'OUT_SEC', condition: 'WS-IDX > 2' }, { name: '100-EXIT' }, { name: '100-EXIT OF OUT_SEC' }, { name: 'HELLO_' }]
    });
    const bps = (response.body as DebugProtocol.SetFunctionBreakpointsResponse['body']).breakpoints;
    expect(bps[0]).toMatchObject({ verified: true, line: 37 });
    expect(bps[0].message).toBe('OUT_SEC (section of HELLO) -> hello.cob:37; condition not applied: line 37 is shared by breakpoints with different conditions');
    expect(bps[1].verified).toBe(false);
    expect(bps[1].message).toMatch(/100-EXIT exists more than once in HELLO \(section IN_SEC, section OUT_SEC\); qualify it \(100-EXIT OF IN_SEC\)/);
    expect(bps[2]).toMatchObject({ verified: true, line: 37 });
    expect(bps[3]).toEqual({ id: 500, verified: true });
    // The section's condition and the unconditional paragraph share line 37: sent unconditional, the section says so.
    const last = sends[sends.length - 1];
    expect(last.breakpoints).toEqual([{ line: 37 }]);
    expect(bps[0].message).toBe('OUT_SEC (section of HELLO) -> hello.cob:37; condition not applied: line 37 is shared by breakpoints with different conditions');
    expect(h.engine.received('setFunctionBreakpoints')[0].arguments).toEqual({ breakpoints: [{ name: 'HELLO_' }] });
  });

  it('a PROGRAM-ID binds at the program\'s entry line, past a DECLARATIVES handler that precedes it', async () => {
    const manifest = helloWithStatements();
    const program = manifest.programs[0];
    // A USE handler's paragraph and statement come first in the source; cobc's Entry comment names line 31.
    program.procedure.paragraphs = [
      { name: 'IO-ERR-PARA', kind: 'paragraph', sourceFileId: 1, startLine: 20, endLine: 30 },
      ...program.procedure.paragraphs
    ];
    program.procedure.statements = [{ sourceFileId: 1, line: 21, verb: 'DISPLAY' }, ...program.procedure.statements];
    program.procedureDivisionLine = 20;
    program.entryLine = 31;
    h = await startShim({ manifests: [manifest], engineSetup: (engine) => void codelldbBreakpoints(engine) });
    await bringUp(h);
    const response = await h.client.request('setFunctionBreakpoints', { breakpoints: [{ name: 'HELLO' }] });
    const [bp] = (response.body as DebugProtocol.SetFunctionBreakpointsResponse['body']).breakpoints;
    expect(bp).toMatchObject({ verified: true, line: 32 });
  });

  it('an engine refusal of the file union leaves the function breakpoint unverified with the engine message', async () => {
    h = await startShim({
      manifests: [helloWithStatements()],
      engineSetup: (engine) => {
        engine.on('setBreakpoints', () => {
          throw new Error('Not supported in noDebug mode');
        });
        engine.on('setFunctionBreakpoints', () => ({ breakpoints: [] }));
      }
    });
    await bringUp(h);
    const response = await h.client.request('setFunctionBreakpoints', { breakpoints: [{ name: '1000-INIT' }] });
    const [bp] = (response.body as DebugProtocol.SetFunctionBreakpointsResponse['body']).breakpoints;
    expect(bp.verified).toBe(false);
    expect(bp.message).toMatch(/1000-INIT \(paragraph of HELLO\) -> hello\.cob:37: .*noDebug/);
  });
});

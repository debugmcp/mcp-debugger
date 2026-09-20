/**
 * The shim's per-file breakpoint union (milestone M3): one engine entry per line, an
 * honest condition, one spelling of a file's path, and the client's view of the
 * engine's answers.
 */
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { BreakpointTable, FUNCTION_BP_ID_BASE } from '../../../src/shim/breakpoint-table.js';

const FILE = path.resolve('/work/cobol/examples/hello.cob');
const lines = (send: { args: { breakpoints?: Array<{ line: number; condition?: string }> } }): Array<[number, string | undefined]> =>
  (send.args.breakpoints ?? []).map((bp) => [bp.line, bp.condition]);

describe('BreakpointTable', () => {
  it('sends one entry per line and answers each client entry from its line', () => {
    const table = new BreakpointTable();
    const send = table.setUserBreakpoints({ path: FILE }, [{ line: 32 }, { line: 33, logMessage: 'at 33' }, { line: 32 }]);
    expect(lines(send)).toEqual([[32, undefined], [33, undefined]]);
    const view = table.recordResponse(send.key, [{ id: 1, line: 32, verified: true }, { id: 2, line: 33, verified: true }]);
    expect(view).toEqual([{ id: 1, line: 32, verified: true }, { id: 2, line: 33, verified: true }, { id: 1, line: 32, verified: true }]);
    expect(table.logMessagesOf([2])).toEqual(['at 33']);
    expect(table.isLogpointOnlyHit([2])).toBe(true);
    expect(table.isLogpointOnlyHit([1])).toBe(false);
  });

  it('keeps a condition every breakpoint on the line asked for, and drops disagreeing ones with a message', () => {
    const table = new BreakpointTable();
    let send = table.setUserBreakpoints({ path: FILE }, [{ line: 32, condition: 'WS-IDX > 2' }, { line: 32, condition: 'WS-IDX > 2' }]);
    expect(lines(send)).toEqual([[32, 'WS-IDX > 2']]);
    let view = table.recordResponse(send.key, [{ id: 1, line: 32, verified: true }]);
    expect(view.map((bp) => bp.message)).toEqual([undefined, undefined]);

    send = table.setUserBreakpoints({ path: FILE }, [{ line: 32, condition: 'WS-IDX > 2' }, { line: 32 }]);
    expect(lines(send)).toEqual([[32, undefined]]);
    view = table.recordResponse(send.key, [{ id: 1, line: 32, verified: true }]);
    expect(view[0].message).toBe('condition not applied: line 32 is shared by breakpoints with different conditions');
    expect(view[1].message).toBeUndefined();

    // A function breakpoint's own condition travels, and never leaks onto a line breakpoint.
    table.addFunctionBreakpoint('1000-INIT', FILE, 37, '1000-INIT (paragraph of HELLO)', 'WS-IDX = 1');
    send = table.setUserBreakpoints({ path: FILE }, [{ line: 32 }]);
    expect(lines(send)).toEqual([[32, undefined], [37, 'WS-IDX = 1']]);
    table.addFunctionBreakpoint('2000-COMPUTE', FILE, 32, '2000-COMPUTE (paragraph of HELLO)', 'WS-IDX = 5');
    send = table.engineSendFor(send.key);
    expect(lines(send)).toEqual([[32, undefined], [37, 'WS-IDX = 1']]);
    view = table.recordResponse(send.key, [{ id: 1, line: 32, verified: true }, { id: 3, line: 37, verified: true }]);
    expect(view[0].message).toBeUndefined();
    const conflicting = table.functionBreakpoints().find((r) => r.name === '2000-COMPUTE')!;
    expect(conflicting.verified).toBe(true);
    expect(conflicting.note).toBe('condition not applied: line 32 is shared by breakpoints with different conditions');
    const kept = table.functionBreakpoints().find((r) => r.name === '1000-INIT')!;
    expect(kept.note).toBeUndefined();
  });

  it('sends a hitCondition only when the line carries that one breakpoint, and says so otherwise', () => {
    const table = new BreakpointTable();
    let send = table.setUserBreakpoints({ path: FILE }, [{ line: 32, hitCondition: '>5' }]);
    expect(send.args.breakpoints?.[0]).toEqual({ line: 32, hitCondition: '>5' });
    send = table.setUserBreakpoints({ path: FILE }, [{ line: 32, hitCondition: '>5' }, { line: 32 }]);
    expect(send.args.breakpoints?.[0]).toEqual({ line: 32 });
    const view = table.recordResponse(send.key, [{ id: 1, line: 32, verified: true }]);
    expect(view[0].message).toBe('hitCondition not applied: line 32 carries more than this breakpoint');
    expect(view[1].message).toBeUndefined();
  });

  it('is one file under every spelling of its path, sent under the first spelling seen', () => {
    const table = new BreakpointTable();
    const first = table.setUserBreakpoints({ path: path.join('/work', 'cobol', 'examples', 'hello.cob') }, [{ line: 32 }]);
    const dotted = table.setUserBreakpoints({ path: path.join('/work', 'cobol', '.', 'examples', 'hello.cob') }, [{ line: 34 }]);
    const upper = table.setUserBreakpoints({ path: path.join('/WORK', 'COBOL', 'examples', 'HELLO.cob') }, [{ line: 35 }]);
    expect(dotted.key).toBe(first.key);
    expect(upper.key).toBe(first.key);
    expect(dotted.args.source.path).toBe(first.args.source.path);
    expect(upper.args.source.path).toBe(first.args.source.path);
    // The last send replaced the client's list for the file, as DAP says.
    expect(lines(upper)).toEqual([[35, undefined]]);
    table.addFunctionBreakpoint('X', path.join('/work', 'cobol', 'examples', '..', 'examples', 'hello.cob'), 37, 'X');
    expect(lines(table.engineSendFor(first.key))).toEqual([[35, undefined], [37, undefined]]);
  });

  it('translates hits and breakpoint events: function ids added, function-only lines never shown under the engine id', () => {
    const table = new BreakpointTable();
    const record = table.addFunctionBreakpoint('1000-INIT', FILE, 37, '1000-INIT (paragraph of HELLO)');
    expect(record.id).toBe(FUNCTION_BP_ID_BASE);
    const send = table.setUserBreakpoints({ path: FILE }, [{ line: 32 }]);
    table.recordResponse(send.key, [{ id: 1, line: 32, verified: true }, { id: 2, line: 37, verified: false, message: 'Resolved locations: 0' }]);
    expect(record.verified).toBe(false);
    expect(table.translateHitIds([1, 2, 99])).toEqual([1, record.id, 99]);
    const events = table.translateBreakpointEvent({ reason: 'changed', breakpoint: { id: 2, line: 37, verified: true } });
    expect(events).toEqual([{ reason: 'changed', breakpoint: { id: record.id, line: 37, verified: true } }]);
    expect(record.verified).toBe(true);
  });
});

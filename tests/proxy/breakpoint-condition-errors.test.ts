/**
 * Issue #853: js-debug reports a breakpoint whose condition (or compiled
 * logpoint) does not parse only as a stderr output line during the
 * setBreakpoints request, and answers the breakpoint itself as an ordinary
 * unbound one. The proxy correlates that line with the request in flight
 * and stamps it onto the response's breakpoint, so the adapter's own words
 * reach list_breakpoints and the launch warning.
 */
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import type { DebugProtocol } from '@vscode/debugprotocol';
import {
  parseConditionSyntaxError,
  stampConditionSyntaxErrors,
  sendSetBreakpointsStamping,
  watchConditionSyntaxErrors,
  matchStoredBreakpoint,
  type ConditionSyntaxError
} from '../../src/proxy/breakpoint-condition-errors.js';

const CONDITION_LINE = 'Syntax error setting breakpoint with condition "n >=" on line 6: Unexpected token \';\'';
const LOGPOINT_LINE = 'Syntax error setting breakpoint with condition {0} on line 7: Invalid or unexpected token';

function response(breakpoints: DebugProtocol.Breakpoint[]): DebugProtocol.SetBreakpointsResponse {
  return { seq: 1, type: 'response', request_seq: 1, command: 'setBreakpoints', success: true, body: { breakpoints } };
}

describe('parseConditionSyntaxError', () => {
  it("parses js-debug's line for a condition, quoting the condition text", () => {
    expect(parseConditionSyntaxError(CONDITION_LINE)).toEqual({
      line: 6,
      condition: 'n >=',
      text: CONDITION_LINE
    });
  });

  it("parses the logpoint form, whose {0} placeholder js-debug leaves unfilled", () => {
    expect(parseConditionSyntaxError(LOGPOINT_LINE)).toEqual({ line: 7, text: LOGPOINT_LINE });
  });

  it('anchors on the last " on line N: ", so a condition containing that text still parses', () => {
    const tricky = 'x === " on line 3: " && y';
    const parsed = parseConditionSyntaxError(`Syntax error setting breakpoint with condition ${JSON.stringify(tricky)} on line 12: Unexpected token`);
    expect(parsed).toEqual({ line: 12, condition: tricky, text: `Syntax error setting breakpoint with condition ${JSON.stringify(tricky)} on line 12: Unexpected token` });
  });

  it('ignores any other output', () => {
    expect(parseConditionSyntaxError('Debugger attached.')).toBeUndefined();
    expect(parseConditionSyntaxError('Syntax error setting breakpoint with condition on line x: y')).toBeUndefined();
  });

  it('shortens a long quoted condition in the stamped text (a compiled logpoint is hundreds of characters)', () => {
    const long = 'a'.repeat(300);
    const parsed = parseConditionSyntaxError(`Syntax error setting breakpoint with condition ${JSON.stringify(long)} on line 3: Unexpected end of input`);
    expect(parsed?.condition).toBe(long);
    expect(parsed?.text.length).toBeLessThan(200);
    expect(parsed?.text).toMatch(/^Syntax error setting breakpoint with condition "a{40,80}…" on line 3: Unexpected end of input$/);
  });
});

describe('stampConditionSyntaxErrors', () => {
  const errors: ConditionSyntaxError[] = [
    { line: 6, condition: 'n >=', text: CONDITION_LINE },
    { line: 7, text: LOGPOINT_LINE }
  ];

  it('stamps the unverified breakpoint at the reported line, displacing a provisional message', () => {
    const resp = response([
      { verified: false, line: 6, message: 'Unbound breakpoint' },
      { verified: false, line: 7, message: 'Unbound breakpoint' },
      { verified: true, line: 9 }
    ]);
    const requested = [{ line: 6, condition: 'n >=' }, { line: 7, logMessage: 'n={n +}' }, { line: 9 }];

    expect(stampConditionSyntaxErrors(requested, resp, errors)).toBe(2);
    expect(resp.body.breakpoints.map((b) => b.message)).toEqual([CONDITION_LINE, LOGPOINT_LINE, undefined]);
  });

  it('matches by condition text when two breakpoints share a line, and never touches a verified one', () => {
    const resp = response([
      { verified: false, line: 6 },
      { verified: true, line: 6 }
    ]);
    const requested = [{ line: 6, condition: 'n >=' }, { line: 6, condition: 'n > 1' }];

    expect(stampConditionSyntaxErrors(requested, resp, errors)).toBe(1);
    expect(resp.body.breakpoints[0].message).toBe(CONDITION_LINE);
    expect(resp.body.breakpoints[1].message).toBeUndefined();

    const swapped = response([{ verified: false, line: 6 }, { verified: false, line: 6 }]);
    expect(stampConditionSyntaxErrors([{ line: 6, condition: 'n > 1' }, { line: 6, condition: 'n >=' }], swapped, errors)).toBe(1);
    expect(swapped.body.breakpoints.map((b) => b.message)).toEqual([undefined, CONDITION_LINE]);
  });

  it('leaves an ambiguous line-only match alone and tolerates a missing body', () => {
    const resp = response([{ verified: false, line: 7 }, { verified: false, line: 7 }]);
    expect(stampConditionSyntaxErrors([{ line: 7, logMessage: 'a' }, { line: 7, logMessage: 'b' }], resp, errors)).toBe(0);
    expect(stampConditionSyntaxErrors([{ line: 7 }], undefined, errors)).toBe(0);
    expect(stampConditionSyntaxErrors([{ line: 7 }], { ...response([]), body: undefined } as never, errors)).toBe(0);
  });
});

describe('sendSetBreakpointsStamping', () => {
  function clientEmitting(lines: string[], opts: { category?: string; after?: boolean } = {}) {
    const client = new EventEmitter();
    const send = vi.fn(async () => {
      if (!opts.after) {
        for (const output of lines) {
          client.emit('output', { category: opts.category ?? 'stderr', output });
        }
      }
      const resp = response([{ verified: false, line: 6, message: 'Unbound breakpoint' }]);
      if (opts.after) {
        setTimeout(() => {
          for (const output of lines) {
            client.emit('output', { category: 'stderr', output });
          }
        }, 0);
      }
      return resp;
    });
    return { client, send };
  }

  it('stamps lines emitted while the request is in flight and stops listening afterwards', async () => {
    const { client, send } = clientEmitting([CONDITION_LINE]);
    const resp = await sendSetBreakpointsStamping(client, [{ line: 6, condition: 'n >=' }], send);
    expect(resp.body.breakpoints[0].message).toBe(CONDITION_LINE);
    expect(client.listenerCount('output')).toBe(0);
  });

  it('ignores lines after the response and non-stderr output', async () => {
    const late = clientEmitting([CONDITION_LINE], { after: true });
    const lateResp = await sendSetBreakpointsStamping(late.client, [{ line: 6, condition: 'n >=' }], late.send);
    await new Promise((r) => setTimeout(r, 5));
    expect(lateResp.body.breakpoints[0].message).toBe('Unbound breakpoint');

    const stdout = clientEmitting([CONDITION_LINE], { category: 'stdout' });
    const stdoutResp = await sendSetBreakpointsStamping(stdout.client, [{ line: 6, condition: 'n >=' }], stdout.send);
    expect(stdoutResp.body.breakpoints[0].message).toBe('Unbound breakpoint');
  });

  it('propagates a failed send and still removes its listener', async () => {
    const client = new EventEmitter();
    await expect(sendSetBreakpointsStamping(client, [{ line: 6 }], async () => { throw new Error('refused'); })).rejects.toThrow('refused');
    expect(client.listenerCount('output')).toBe(0);
  });
});

describe('watchConditionSyntaxErrors', () => {
  it('collects matching stderr lines until stopped', () => {
    const client = new EventEmitter();
    const watch = watchConditionSyntaxErrors(client);
    client.emit('output', { category: 'stderr', output: CONDITION_LINE });
    client.emit('output', { category: 'stdout', output: CONDITION_LINE });
    client.emit('output', { category: 'stderr', output: 'Debugger attached.' });
    const errors = watch.stop();
    client.emit('output', { category: 'stderr', output: LOGPOINT_LINE });
    expect(errors.map((e) => e.line)).toEqual([6]);
    expect(client.listenerCount('output')).toBe(0);
  });
});

describe('matchStoredBreakpoint', () => {
  const stored = new Map<string, DebugProtocol.SourceBreakpoint[]>([
    ['/app/a.js', [{ line: 6, condition: 'n >=' }, { line: 7, logMessage: 'x={x +}' }]],
    ['/app/b.js', [{ line: 6, condition: 'n > 1' }, { line: 9, logMessage: 'y' }]]
  ]);

  it('finds the one stored breakpoint across files that the line and condition name', () => {
    expect(matchStoredBreakpoint(stored, { line: 6, condition: 'n >=', text: CONDITION_LINE }))
      .toEqual({ path: '/app/a.js', breakpoint: { line: 6, condition: 'n >=' } });
    expect(matchStoredBreakpoint(stored, { line: 7, text: LOGPOINT_LINE }))
      .toEqual({ path: '/app/a.js', breakpoint: { line: 7, logMessage: 'x={x +}' } });
  });

  it('declines an ambiguous or unknown line', () => {
    const twins = new Map<string, DebugProtocol.SourceBreakpoint[]>([
      ['/app/a.js', [{ line: 7, logMessage: 'a' }]],
      ['/app/b.js', [{ line: 7, logMessage: 'b' }]]
    ]);
    expect(matchStoredBreakpoint(twins, { line: 7, text: LOGPOINT_LINE })).toBeUndefined();
    expect(matchStoredBreakpoint(stored, { line: 42, text: LOGPOINT_LINE })).toBeUndefined();
  });
});

/**
 * buildRunToCompletionSummary (issue #701): a launch that ended STOPPED must
 * say how the program ended, with what code, and which breakpoints it ran
 * past — unless a stop was recorded before the exit, in which case the
 * breakpoints were not all missed and the stop is named instead.
 */
import { describe, it, expect } from 'vitest';
import { buildRunToCompletionSummary } from '../../../../../src/session/breakpoints/launch-warnings.js';
import { OutputRingBuffer } from '../../../../../src/session/output-buffer.js';
import type { ManagedSession } from '../../../../../src/session/session-store.js';

type LineBp = { file: string; line: number; requestedLine?: number; verified: boolean; message?: string; logMessage?: string };
type FnBp = { functionName: string; verified: boolean };
type BuilderSession = {
  breakpoints: Map<string, LineBp>;
  functionBreakpoints?: Map<string, FnBp>;
  exitCode?: number;
  lastStop?: { reason: string };
  descendantStops?: number;
  adapterCapabilities?: { supportsLogPoints?: boolean };
  programEndExplanation?: { note?: string; data?: Record<string, unknown> };
  outputBuffer?: OutputRingBuffer;
  run?: {
    attachMode?: boolean;
    childDebuggingOptedOut?: 'subProcess: false' | 'autoAttachChildProcesses: false' | 'adapter-default';
    treeVerifiedBreakpointIds?: Set<string>;
  };
};

function build(session: BuilderSession) {
  return buildRunToCompletionSummary(
    session as unknown as Pick<ManagedSession, 'breakpoints' | 'functionBreakpoints' | 'exitCode' | 'lastStop' | 'descendantStops' | 'adapterCapabilities' | 'programEndExplanation'> &
      Partial<Pick<ManagedSession, 'run' | 'outputBuffer'>>
  );
}

// Issue #1128: the summary was read off the root alone. A child session's
// stops are recorded on the child, and its breakpoints are copies — so a
// root whose child stopped on child.py:12 twice ended with "without hitting
// any breakpoint. Verified but never hit: child.py:12". The rule a single
// session already has (a stop recorded in the run withholds the list) now
// covers the session's tree.
describe('buildRunToCompletionSummary for a session whose child sessions stopped (issue #1128)', () => {
  const childBreakpoint = (): Map<string, LineBp> =>
    new Map([['a', { file: '/work/tree/child.py', line: 12, verified: true }]]);

  it('does not say the program hit nothing, and lists no breakpoint as unhit', () => {
    const result = build({ exitCode: 0, breakpoints: childBreakpoint(), descendantStops: 2 });

    expect(result.summary).toBe('The program ran to completion (exit code 0). Its child sessions stopped 2 times during this run.');
    expect(result.data).toEqual({ exitCode: 0 });
  });

  it('counts one stop as one', () => {
    expect(build({ exitCode: 0, breakpoints: childBreakpoint(), descendantStops: 1 }).summary)
      .toBe('The program ran to completion (exit code 0). Its child sessions stopped 1 time during this run.');
  });

  it('covers a breakpoint the root never bound as well: it is not reported as never bound and never hit', () => {
    const result = build({
      exitCode: 0,
      breakpoints: new Map([['a', { file: '/work/tree/child.js', line: 14, verified: false, message: 'Unbound breakpoint' }]]),
      descendantStops: 2
    });

    expect(result.summary).not.toContain('without hitting any breakpoint');
    expect(result.data).not.toHaveProperty('unhitBreakpoints');
  });

  it("keeps the session's own unreported stop first: that is the more specific fact", () => {
    const result = build({ exitCode: 0, breakpoints: childBreakpoint(), lastStop: { reason: 'breakpoint' }, descendantStops: 2 });

    expect(result.summary).toBe('The program ran to completion (exit code 0) after a stop the launch could not report (last stop: breakpoint).');
  });

  it('a tree that never stopped is summarized as before', () => {
    expect(build({ exitCode: 0, breakpoints: childBreakpoint() }).summary)
      .toBe('The program ran to completion (exit code 0) without hitting any breakpoint. Verified but never hit: child.py:12.');
  });

  it("still joins the adapter's reading of the end", () => {
    const result = build({
      exitCode: 0,
      breakpoints: childBreakpoint(),
      descendantStops: 1,
      programEndExplanation: { note: 'The device went away.' }
    });

    expect(result.summary).toBe(
      'The program ran to completion (exit code 0). Its child sessions stopped 1 time during this run. The device went away.'
    );
  });
});

describe('buildRunToCompletionSummary', () => {
  it('names a non-zero exit as an exit, a zero as a completed run, and a missing code as unreported', () => {
    const none = new Map<string, LineBp>();
    expect(build({ exitCode: 3, breakpoints: none }).summary).toBe('The program exited with code 3.');
    expect(build({ exitCode: 0, breakpoints: none }).summary).toBe('The program ran to completion (exit code 0).');
    expect(build({ breakpoints: none }).summary).toBe('The program ended without reporting an exit code.');
    expect(build({ exitCode: 0, breakpoints: none }).data).toEqual({ exitCode: 0, unhitBreakpoints: [] });
    expect('exitCode' in build({ breakpoints: none }).data).toBe(false);
  });

  it('lists every breakpoint the program ran past and names the verified ones, line and function alike', () => {
    const result = build({
      exitCode: 0,
      breakpoints: new Map([
        ['a', { file: '/work/src/app.ts', line: 93, requestedLine: 91, verified: true }],
        ['b', { file: '/work/src/other.ts', line: 12, verified: false, message: 'Unbound breakpoint' }]
      ]),
      functionBreakpoints: new Map([
        ['f', { functionName: 'helper', verified: true }],
        ['g', { functionName: 'missing', verified: false }]
      ])
    });
    expect(result.data.unhitBreakpoints).toEqual([
      { file: '/work/src/app.ts', line: 93, requestedLine: 91, verified: true },
      { file: '/work/src/other.ts', line: 12, verified: false }
    ]);
    expect(result.summary).toBe(
      "The program ran to completion (exit code 0) without hitting any breakpoint. Verified but never hit: app.ts:93, function 'helper'."
    );
  });

  it('keeps the breakpoint clause without the verified sentence when nothing was verified', () => {
    const result = build({
      exitCode: 0,
      breakpoints: new Map([['b', { file: '/work/src/other.ts', line: 12, verified: false }]])
    });
    expect(result.summary).toBe('The program ran to completion (exit code 0) without hitting any breakpoint.');
  });

  it('leaves out logpoints the adapter supports, and keeps a downgraded one', () => {
    const logpoint = { file: '/work/src/app.ts', line: 5, verified: true, logMessage: 'x={x}' };
    const supported = build({
      exitCode: 0,
      breakpoints: new Map([['l', logpoint]]),
      adapterCapabilities: { supportsLogPoints: true }
    });
    expect(supported.data.unhitBreakpoints).toEqual([]);
    expect(supported.summary).toBe('The program ran to completion (exit code 0).');

    const downgraded = build({
      exitCode: 0,
      breakpoints: new Map([['l', logpoint]]),
      adapterCapabilities: { supportsLogPoints: false }
    });
    expect(downgraded.data.unhitBreakpoints).toHaveLength(1);
    expect(downgraded.summary).toContain('Verified but never hit: app.ts:5.');
  });

  it('withholds the list and names the stop when one was recorded before the exit', () => {
    const result = build({
      exitCode: 0,
      lastStop: { reason: 'breakpoint' },
      breakpoints: new Map([['a', { file: '/work/src/app.ts', line: 91, verified: true }]])
    });
    expect(result.summary).toBe(
      'The program ran to completion (exit code 0) after a stop the launch could not report (last stop: breakpoint).'
    );
    expect(result.data).toEqual({ exitCode: 0 });
  });

  it("joins the adapter's reading of the end to the sentence and the data, its own fields winning (issue #877)", () => {
    const { summary, data } = build({
      breakpoints: new Map(),
      exitCode: 1,
      programEndExplanation: { note: 'the device list.', data: { exitCode: 99, availableDevices: [{ id: 'windows' }] } },
    });

    expect(summary).toMatch(/exited with code 1/);
    expect(summary.endsWith(' the device list.')).toBe(true);
    expect(data.exitCode).toBe(1);
    expect((data as Record<string, unknown>).availableDevices).toEqual([{ id: 'windows' }]);
  });

  it('does not claim child processes existed when child debugging was opted out, and does not blame the caller when the adapter turned it off (m5)', () => {
    const bp = new Map<string, LineBp>([['a', { file: '/work/child.js', line: 14, verified: false }]]);

    const callerOptOut = build({
      exitCode: 0,
      breakpoints: bp,
      run: { childDebuggingOptedOut: 'autoAttachChildProcesses: false' }
    });
    expect(callerOptOut.summary).not.toContain('so child processes were not debugged');
    expect(callerOptOut.summary).toContain('child-process debugging was off via autoAttachChildProcesses: false, so any child processes would not be debugged');

    const adapterDefaultOff = build({
      breakpoints: bp,
      run: { attachMode: true, childDebuggingOptedOut: 'adapter-default' }
    });
    expect(adapterDefaultOff.summary).not.toContain('autoAttachChildProcesses: false');
    expect(adapterDefaultOff.summary).not.toContain('attach_to_process');
    expect(adapterDefaultOff.summary).not.toContain('so child processes were not debugged');
    expect(adapterDefaultOff.summary).toContain(
      'no breakpoint was hit in the attached process (on an attach, processes the target starts afterwards are not debugged unless requested, so a breakpoint in code only such a process runs is never hit; adapterConfig: { autoAttachChildProcesses: true } on the attach requests it for a target reached through a local endpoint, but it changes the target: each process it starts from then on is made to load a file from this server (through NODE_OPTIONS) and to wait at startup for the debugger, so it can fail to start if the target cannot load this server\'s file, starts late when the target forks fast, and can be left waiting if it is forked during a detach (#1286)).'
    );
  });

  it('scopes the "Verified ... but never hit" clause to the launched or attached process when child debugging is off (N11, M29)', () => {
    const verifiedLaunch = build({
      exitCode: 0,
      breakpoints: new Map<string, LineBp>([['a', { file: '/work/app.py', line: 10, verified: true }]]),
      run: { childDebuggingOptedOut: 'subProcess: false' }
    });
    expect(verifiedLaunch.summary).toContain('Verified in the launched process but never hit: app.py:10.');

    const verifiedAttach = build({
      breakpoints: new Map<string, LineBp>([['a', { file: '/work/app.js', line: 14, verified: true }]]),
      run: { attachMode: true, childDebuggingOptedOut: 'adapter-default' }
    });
    expect(verifiedAttach.summary).toContain('in the attached process (on an attach, processes the target starts afterwards are not debugged unless requested');
    expect(verifiedAttach.summary).toContain('adapterConfig: { autoAttachChildProcesses: true } on the attach requests it');
    expect(verifiedAttach.summary).toContain('Verified in the attached process but never hit: app.js:14.');
  });

  describe('outputTail on non-zero exit (issues #1254, #1136)', () => {
    function bufferOf(...entries: Array<{ category?: string; output: string }>): OutputRingBuffer {
      const buf = new OutputRingBuffer();
      for (const entry of entries) {
        buf.push(entry.category ?? 'stderr', entry.output);
      }
      return buf;
    }

    it('carries outputTail and points the summary at get_output without repeating the lines when exitCode is non-zero', () => {
      const outputBuffer = bufferOf(
        { output: 'No test files found, exiting with code 1\n' },
        { output: 'filter: unknown\n' }
      );
      const result = build({ exitCode: 1, breakpoints: new Map(), outputBuffer });

      expect((result.data as { outputTail?: string[] }).outputTail).toEqual([
        'No test files found, exiting with code 1',
        'filter: unknown'
      ]);
      expect(result.summary).toContain('The program exited with code 1.');
      expect(result.summary).toContain('get_output');
      expect(result.summary).not.toContain('No test files found');
      expect(result.summary).not.toContain('filter: unknown');
    });

    it('omits outputTail and the get_output clause for exitCode 0, for an unreported exitCode, and for an empty buffer', () => {
      const populated = bufferOf({ output: 'all good\n' });
      const zero = build({ exitCode: 0, breakpoints: new Map(), outputBuffer: populated });
      expect(zero.data).not.toHaveProperty('outputTail');
      expect(zero.summary).toBe('The program ran to completion (exit code 0).');

      const unreported = build({ breakpoints: new Map(), outputBuffer: populated });
      expect(unreported.data).not.toHaveProperty('outputTail');
      expect(unreported.summary).toBe('The program ended without reporting an exit code.');

      const empty = build({ exitCode: 1, breakpoints: new Map(), outputBuffer: new OutputRingBuffer() });
      expect(empty.data).not.toHaveProperty('outputTail');
      expect(empty.summary).toBe('The program exited with code 1.');

      const whitespaceOnly = build({ exitCode: 1, breakpoints: new Map(), outputBuffer: bufferOf({ output: '  \n\r\n ' }) });
      expect(whitespaceOnly.data).not.toHaveProperty('outputTail');
      expect(whitespaceOnly.summary).toBe('The program exited with code 1.');
    });

    it('bounds outputTail to the last 8 non-empty program lines and 300 characters per line without gluing cross-stream entries', () => {
      const longLine = 'x'.repeat(340);
      const outputBuffer = bufferOf(
        ...Array.from({ length: 10 }, (_, idx) => ({ category: 'stdout', output: `line ${idx + 1}\n` })),
        // No trailing newline on stdout ahead of console + stderr: must stay separate from stderr.
        { category: 'stdout', output: 'entry without newline' },
        { category: 'console', output: 'adapter console note\n' },
        { category: 'stderr', output: `${longLine}\n` }
      );
      const result = build({ exitCode: 1, breakpoints: new Map(), outputBuffer });
      const tail = (result.data as { outputTail?: string[] }).outputTail;

      expect(tail).toHaveLength(8);
      expect(tail?.[0]).toBe('line 5');
      expect(tail?.[5]).toBe('line 10');
      expect(tail?.[6]).toBe('entry without newline');
      expect(tail?.[7]).toBe(`${'x'.repeat(300)}…`);
    });

    it('keeps the outputTail pointer clause in the summary when a stop and a non-zero exit land together (T05)', () => {
      const outputBuffer = bufferOf({ output: 'fatal right after breakpoint\n' });
      const result = build({
        exitCode: 1,
        lastStop: { reason: 'breakpoint' },
        breakpoints: new Map([['a', { file: '/work/src/app.ts', line: 91, verified: true }]]),
        outputBuffer
      });

      expect(result.data).toEqual({
        exitCode: 1,
        outputTail: ['fatal right after breakpoint']
      });
      expect(result.summary).toBe(
        'The program exited with code 1 after a stop the launch could not report (last stop: breakpoint). See outputTail (get_output has the full output).'
      );
    });
  });
});


it('avoids repeating without when an attach reports no exit code (#1288)', () => {
  const result = build({ breakpoints: new Map([['bp', { file: '/parent.js', line: 21, verified: true }]]), run: { attachMode: true } });
  expect(result.summary).toBe('The program ended without reporting an exit code; no breakpoint was hit. Verified but never hit: parent.js:21.');
});

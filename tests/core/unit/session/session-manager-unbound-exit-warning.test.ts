/**
 * buildUnboundBreakpointExitWarning (issue #467): a launch that ran to
 * completion with breakpoints that never bound must say so in the
 * start_debugging response, surfacing the per-breakpoint diagnostics the
 * store already holds.
 */
import { describe, it, expect } from 'vitest';
import { buildUnboundBreakpointExitWarning } from '../../../../src/session/breakpoints/launch-warnings.js';

type BuilderSession = {
  breakpoints: Map<string, { id?: string; file: string; line: number; verified: boolean; message?: string }>;
  releasedChildReports?: number;
  unconfirmedChildReleases?: number;
  run?: {
    childDebuggingOptedOut?: 'subProcess: false' | 'autoAttachChildProcesses: false' | 'adapter-default';
    treeVerifiedBreakpointIds?: Set<string>;
  };
};

function build(session: BuilderSession): string | undefined {
  // The builder is a free function over the breakpoint store and tree/run fields.
  return buildUnboundBreakpointExitWarning(
    session as unknown as Parameters<typeof buildUnboundBreakpointExitWarning>[0]
  );
}

describe('buildUnboundBreakpointExitWarning', () => {
  it('names each unbound breakpoint with its stored diagnostic', () => {
    const warning = build({
      breakpoints: new Map([
        ['a', {
          file: '/workspace/examples/rust/hello_world/src/main.rs',
          line: 27,
          verified: false,
          message: 'could not be resolved, but a valid location was found at /workspace/rust/hello_world/src/main.rs:27'
        }]
      ])
    });
    expect(warning).toMatch(/1 breakpoint\(s\) never bound/);
    expect(warning).toMatch(/main\.rs:27/);
    expect(warning).toMatch(/valid location was found/);
    expect(warning).toMatch(/list_breakpoints/);
  });

  it('stays silent when every breakpoint bound', () => {
    expect(
      build({
        breakpoints: new Map([
          ['a', { file: '/p/x.rs', line: 3, verified: true }]
        ])
      })
    ).toBeUndefined();
  });

  it('stays silent with no breakpoints', () => {
    expect(build({ breakpoints: new Map() })).toBeUndefined();
  });

  it('counts multiple unbound breakpoints', () => {
    const warning = build({
      breakpoints: new Map([
        ['a', { file: '/p/x.rs', line: 3, verified: false }],
        ['b', { file: '/p/y.rs', line: 9, verified: false }],
        ['c', { file: '/p/z.rs', line: 1, verified: true }]
      ])
    });
    expect(warning).toMatch(/2 breakpoint\(s\) never bound/);
    expect(warning).toMatch(/x\.rs:3/);
    expect(warning).toMatch(/y\.rs:9/);
    expect(warning).not.toMatch(/z\.rs/);
  });

  it('explains when released child processes ran undebugged (I3, singular and plural)', () => {
    const bp = new Map([['a', { id: 'a', file: '/w/child.py', line: 12, verified: false }]]);
    const single = build({ breakpoints: bp, releasedChildReports: 1 });
    expect(single).toContain('1 breakpoint(s) never bound in the debugged process during this run: child.py:12.');
    expect(single).toContain('1 child process ran undebugged, so breakpoints in code only it loads could not bind');

    const plural = build({ breakpoints: bp, releasedChildReports: 2 });
    expect(plural).toContain('2 child processes ran undebugged, so breakpoints in code only they load could not bind');
  });

  it('explains when child processes could not be adopted (I3, unconfirmed tail, singular and plural)', () => {
    const bp = new Map([['a', { id: 'a', file: '/w/child.js', line: 14, verified: false }]]);
    const single = build({ breakpoints: bp, unconfirmedChildReleases: 1 });
    expect(single).toContain('1 child process could not be adopted, so breakpoints in code only it loads could not bind');

    const plural = build({ breakpoints: bp, unconfirmedChildReleases: 3 });
    expect(plural).toContain('3 child processes could not be adopted, so breakpoints in code only they load could not bind');
  });

  it('does not blame the caller when the JavaScript adapter itself left child debugging off on attach (m5)', () => {
    const bp = new Map([['a', { id: 'a', file: '/w/child.js', line: 14, verified: false }]]);
    const warning = build({ breakpoints: bp, run: { childDebuggingOptedOut: 'adapter-default' } });
    expect(warning).toContain('child-process debugging is off on an attach unless requested; if the breakpoint\'s code runs in a process the target starts, breakpoints in code only that child process loads cannot bind; enabling adapterConfig: { autoAttachChildProcesses: true } on the attach changes NODE_OPTIONS for the target\'s later children and can leave a child forked during detach waiting (#1286)');
    expect(warning).not.toContain('autoAttachChildProcesses: false');
    expect(warning).not.toContain('attach_to_process');
  });
});

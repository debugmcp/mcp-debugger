/**
 * buildUnboundBreakpointExitWarning (issue #467): a launch that ran to
 * completion with breakpoints that never bound must say so in the
 * start_debugging response, surfacing the per-breakpoint diagnostics the
 * store already holds.
 */
import { describe, it, expect } from 'vitest';
import { SessionManager } from '../../../../src/session/session-manager.js';

type BuilderSession = {
  breakpoints: Map<string, { file: string; line: number; verified: boolean; message?: string }>;
};

function build(session: BuilderSession): string | undefined {
  return (SessionManager.prototype as unknown as {
    buildUnboundBreakpointExitWarning(s: BuilderSession): string | undefined;
  }).buildUnboundBreakpointExitWarning.call({}, session);
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
});

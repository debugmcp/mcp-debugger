import { describe, it, expect } from 'vitest';
import { buildPendingAttachBreakpointClause, buildAttachBreakpointScopeWarning } from '../../../../../src/session/breakpoints/launch-warnings.js';
import { describeLaunchArming } from '../../../../../src/session/launch/launch-arming.js';
import { detectChildDebuggingOptOut, runFactsOf } from '../../../../../src/session/run-facts.js';
import type { ManagedSession } from '../../../../../src/session/session-store.js';

describe('pending attach breakpoint clause (#1288)', () => {
  function build(opts: { language?: string; attached?: boolean; enabled?: boolean; armed?: boolean; hit?: boolean; logpoint?: boolean; supportsLogPoints?: boolean; functionBreakpoint?: boolean; multiple?: boolean } = {}) {
    const language = opts.language ?? 'javascript';
    const attached = opts.attached ?? true;
    const config = language === 'javascript' ? { autoAttachChildProcesses: opts.enabled ?? false } : { subProcess: false };
    const session = {
      id: 'root', run: { attachMode: attached, childDebuggingOptedOut: detectChildDebuggingOptOut(language, attached, config), breakpointStopOccurred: opts.hit },
      breakpoints: new Map(opts.armed === false || opts.functionBreakpoint ? [] : [['bp', { id: 'bp', file: '/target.js', line: 21, verified: true,
        verifiedBy: 'adapter', ...(opts.logpoint ? { logMessage: 'hello' } : {}) }]]),
      functionBreakpoints: new Map(opts.functionBreakpoint ? [['fn', { functionName: 'work', verified: true }]] : []),
      adapterCapabilities: { supportsLogPoints: opts.supportsLogPoints ?? true }
    } as unknown as ManagedSession;
    if (opts.multiple) session.breakpoints.set('second', { ...session.breakpoints.get('bp')!, id: 'second', line: 22 });
    return buildPendingAttachBreakpointClause(describeLaunchArming(session, false), runFactsOf(session, () => session));
  }
  const clause = "If a breakpoint's code runs only in a process the target starts (a fork or a worker process), this attach does not debug that process: see adapterConfig.autoAttachChildProcesses in the attach_to_process description for what turning that on costs.";
  it.each([{}, { functionBreakpoint: true }, { multiple: true }, { logpoint: true, supportsLogPoints: false }])('explains pausing breakpoints %j', opts => {
    expect(build(opts)).toBe(clause);
  });
  it.each([
    { attached: false }, { enabled: true }, { armed: false }, { hit: true },
    { language: 'python' }, { language: 'go' }, { logpoint: true }
  ])('omits the clause for %j', opts => expect(build(opts)).toBeUndefined());
  it('also explains an explicit opt-out', () => {
    expect(buildPendingAttachBreakpointClause({ lineBreakpoints: 1, logpointsThatPause: 0, functionBreakpoints: 0 },
      { attached: true, childDebuggingOptedOut: 'autoAttachChildProcesses: false' })).toBe(clause);
  });
});

describe('attach verification scope warning', () => {
  it('describes the attached process scope from any recorded opt-out', () => {
    expect(buildAttachBreakpointScopeWarning({ attached: true, childDebuggingOptedOut: 'adapter-default' })).toContain('Verified says the breakpoint is bound in the attached process');
  });
  it.each([undefined, { attached: false, childDebuggingOptedOut: 'adapter-default' as const }, { attached: true }])('omits it for %j', run => {
    expect(buildAttachBreakpointScopeWarning(run)).toBeUndefined();
  });
});

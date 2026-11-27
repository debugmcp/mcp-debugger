import { describe, it, expect } from 'vitest';
import { buildPendingAttachBreakpointNote } from '../../../../../src/session/breakpoints/launch-warnings.js';
import { detectChildDebuggingOptOut, runFactsOf } from '../../../../../src/session/run-facts.js';
import type { ManagedSession } from '../../../../../src/session/session-store.js';

describe('pending attach breakpoint note (#1288)', () => {
  function build(opts: { language?: string; attached?: boolean; enabled?: boolean; armed?: boolean; hit?: boolean; logpoint?: boolean; descendantStops?: number } = {}) {
    const language = opts.language ?? 'javascript';
    const attached = opts.attached ?? true;
    const config = language === 'javascript' ? { autoAttachChildProcesses: opts.enabled ?? false } : { subProcess: false };
    const session = {
      id: 'root', run: { attachMode: attached, childDebuggingOptedOut: detectChildDebuggingOptOut(language, attached, config) },
      breakpoints: new Map(opts.armed === false ? [] : [['bp', { id: 'bp', file: '/target.js', line: 21, verified: true,
        verifiedBy: opts.hit ? 'hit' : 'adapter', ...(opts.logpoint ? { logMessage: 'hello' } : {}) }]]),
      functionBreakpoints: new Map(), adapterCapabilities: { supportsLogPoints: true }, descendantStops: opts.descendantStops
    } as unknown as ManagedSession;
    return buildPendingAttachBreakpointNote(session, runFactsOf(session, () => session));
  }
  it('explains the default-off attach despite adapter verification, conditionally and with a pointer', () => {
    expect(build()).toBe('If that line runs in a process the target starts (a fork or a worker process), this attach does not debug it: see adapterConfig.autoAttachChildProcesses in the attach_to_process description for what turning that on costs.');
  });
  it.each([
    { attached: false }, { enabled: true }, { armed: false }, { hit: true },
    { language: 'python' }, { language: 'go' }, { logpoint: true }, { descendantStops: 1 }
  ])('omits the note for %j', opts => expect(build(opts)).toBeUndefined());
  it('also explains an explicit opt-out', () => {
    const session = { breakpoints: new Map([['bp', { verified: false }]]), functionBreakpoints: new Map() } as unknown as ManagedSession;
    expect(buildPendingAttachBreakpointNote(session, { attached: true, childDebuggingOptedOut: 'autoAttachChildProcesses: false' })).toContain('If that line');
  });
});

/**
 * SessionStore.getAll() is the single source of the public DebugSessionInfo
 * list (list_debug_sessions, the HTTP command surface, the output resources),
 * so what it projects is what every consumer can leak. These tests pin the
 * `lastStop` gate at that projection rather than at any one handler.
 */
import { describe, it, expect } from 'vitest';
import { SessionStore } from '../../../../src/session/session-store.js';
import { DebugLanguage, SessionState } from '@debugmcp/shared';

function storeWith(state: SessionState): { store: SessionStore; id: string } {
  const store = new SessionStore();
  const session = store.createSession({ language: DebugLanguage.MOCK });
  const managed = store.get(session.id)!;
  managed.state = state;
  managed.lastStop = { reason: 'breakpoint', threadId: 1, timestamp: 1, description: 'Paused' };
  return { store, id: session.id };
}

describe('SessionStore.getAll() lastStop projection (issue #720)', () => {
  it('omits lastStop for a running session', () => {
    const { store, id } = storeWith(SessionState.RUNNING);

    const listed = store.getAll().find((s) => s.id === id)!;

    expect(listed).not.toHaveProperty('lastStop');
  });

  it('omits lastStop for a session that has not started running yet', () => {
    const { store, id } = storeWith(SessionState.INITIALIZING);

    const listed = store.getAll().find((s) => s.id === id)!;

    expect(listed).not.toHaveProperty('lastStop');
  });

  it('keeps lastStop for a paused session — the stop it is at', () => {
    const { store, id } = storeWith(SessionState.PAUSED);

    const listed = store.getAll().find((s) => s.id === id)!;

    expect(listed.lastStop).toMatchObject({ reason: 'breakpoint', threadId: 1 });
  });

  it('keeps lastStop for terminal sessions — the last stop before they ended', () => {
    for (const state of [SessionState.STOPPED, SessionState.ERROR]) {
      const { store, id } = storeWith(state);

      const listed = store.getAll().find((s) => s.id === id)!;

      expect(listed.lastStop, `state ${state}`).toMatchObject({ reason: 'breakpoint' });
    }
  });
});

describe('SessionStore.getAll() debuggerDisabled projection (issue #749)', () => {
  it('projects debuggerDisabled only while the launch runs with the debugger off', () => {
    const { store, id } = storeWith(SessionState.RUNNING);
    expect(store.getAll().find((s) => s.id === id)!).not.toHaveProperty('debuggerDisabled');

    store.get(id)!.launchDebuggerOff = true;
    expect(store.getAll().find((s) => s.id === id)!.debuggerDisabled).toBe(true);

    store.get(id)!.launchDebuggerOff = undefined;
    expect(store.getAll().find((s) => s.id === id)!).not.toHaveProperty('debuggerDisabled');

    // Only a live launch — initializing (the proxy is up and a breakpoint
    // set now still goes to the adapter), running or paused: over
    // (stopped/error) or never launched (created), the record describes
    // nothing running.
    store.get(id)!.launchDebuggerOff = true;
    for (const state of [SessionState.STOPPED, SessionState.ERROR, SessionState.CREATED]) {
      store.get(id)!.state = state;
      expect(store.getAll().find((s) => s.id === id)!, state).not.toHaveProperty('debuggerDisabled');
    }
    for (const state of [SessionState.INITIALIZING, SessionState.PAUSED]) {
      store.get(id)!.state = state;
      expect(store.getAll().find((s) => s.id === id)!.debuggerDisabled, state).toBe(true);
    }
  });

  it('drops the projection once the adapter has verified a breakpoint — proof this build debugs after all', () => {
    // Measured: every adapter that honours the flag refuses or unbinds a
    // breakpoint under it (js-debug "Unbound breakpoint", debugpy "Server is
    // not available", Delve "noDebug mode: unable to process
    // 'setBreakpoints'", CodeLLDB "Not supported in noDebug mode"), so a
    // record the adapter verified can only come from a build that ignores
    // the flag — as strong as a stop, and it arrives before any hit.
    const { store, id } = storeWith(SessionState.RUNNING);
    const managed = store.get(id)!;
    managed.launchDebuggerOff = true;
    const bp = { id: 'bp-1', file: 'a.py', line: 3, verified: false };
    managed.breakpoints.set(bp.id, bp as never);
    expect(store.getAll().find((s) => s.id === id)!.debuggerDisabled).toBe(true);

    bp.verified = true;
    expect(store.getAll().find((s) => s.id === id)!).not.toHaveProperty('debuggerDisabled');

    // A verified function breakpoint counts the same way.
    bp.verified = false;
    managed.functionBreakpoints.set('fbp-1', { id: 'fbp-1', name: 'main', verified: true } as never);
    expect(store.getAll().find((s) => s.id === id)!).not.toHaveProperty('debuggerDisabled');
  });
});

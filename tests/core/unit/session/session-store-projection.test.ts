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

    store.get(id)!.debuggerDisabled = true;
    expect(store.getAll().find((s) => s.id === id)!.debuggerDisabled).toBe(true);

    store.get(id)!.debuggerDisabled = undefined;
    expect(store.getAll().find((s) => s.id === id)!).not.toHaveProperty('debuggerDisabled');
  });
});

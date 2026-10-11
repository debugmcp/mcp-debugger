/**
 * The three session-state predicates every "is it over / at rest / gone"
 * question goes through (issue #735 item 3).
 */
import { describe, it, expect } from 'vitest';
import {
  SessionLifecycleState,
  SessionState,
  isSessionTerminated,
  isSettledSessionState,
  isTerminalSessionState
} from '../../src/index.js';

const ALL_STATES = Object.values(SessionState);

describe('isTerminalSessionState', () => {
  it('is true for exactly STOPPED and ERROR', () => {
    const terminal = ALL_STATES.filter((state) => isTerminalSessionState(state));
    expect(terminal.sort()).toEqual([SessionState.ERROR, SessionState.STOPPED].sort());
    expect(isTerminalSessionState(undefined)).toBe(false);
  });
});

describe('isSettledSessionState', () => {
  it('is true for PAUSED and the terminal states, nothing else', () => {
    const settled = ALL_STATES.filter((state) => isSettledSessionState(state));
    expect(settled.sort()).toEqual([SessionState.ERROR, SessionState.PAUSED, SessionState.STOPPED].sort());
    expect(isSettledSessionState(undefined)).toBe(false);
  });
});

describe('isSessionTerminated', () => {
  it('reads the lifecycle, not the execution state', () => {
    expect(isSessionTerminated({ sessionLifecycle: SessionLifecycleState.TERMINATED })).toBe(true);
    expect(isSessionTerminated({ sessionLifecycle: SessionLifecycleState.ACTIVE })).toBe(false);
    expect(isSessionTerminated({ sessionLifecycle: SessionLifecycleState.CREATED })).toBe(false);
    expect(isSessionTerminated({})).toBe(false);
  });
});

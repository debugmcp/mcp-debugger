/**
 * A step call that throws after its step has landed (reading the answer) is
 * not a failed resume: the step's catch names it `answer-failed`, which has no
 * row in the transition table, so it is reported. Nothing after the landing
 * throws in ordinary operation (the snapshot catches its own failures); this
 * file makes the snapshot throw to see what the site names.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DebugLanguage, SessionState } from '@debugmcp/shared';
import { SessionManager, type SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { StateShadowError, takeStrictFailures } from '../../../../src/session/machine/shadow.js';
import type { ManagedSession } from '../../../../src/session/session-store.js';
import { createMockDependencies } from './session-manager-test-utils.js';
import { internals } from '../../../test-utils/helpers/operations-internals.js';

/** Armed by a test once its session is paused: only the step's answer then fails. */
const snapshotFails = vi.hoisted(() => ({ armed: false }));

vi.mock('../../../../src/session/inspection/stop-snapshot.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../../src/session/inspection/stop-snapshot.js')>();
  return {
    ...original,
    composeStopSnapshot: vi.fn(async (...args: Parameters<typeof original.composeStopSnapshot>) => {
      if (snapshotFails.armed) throw new Error('reading the answer failed (injected)');
      return original.composeStopSnapshot(...args);
    })
  };
});

const CONFIG: SessionManagerConfig = { logDirBase: '/tmp/test-sessions', defaultDapLaunchArgs: { stopOnEntry: false, justMyCode: true } };

describe('a step that fails after it landed', () => {
  let dependencies: ReturnType<typeof createMockDependencies>;
  let sessionManager: SessionManager;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dependencies = createMockDependencies();
    sessionManager = new SessionManager(CONFIG, dependencies);
  });

  afterEach(() => {
    snapshotFails.armed = false;
    vi.useRealTimers();
    vi.unstubAllEnvs();
    dependencies.mockProxyManager.reset();
  });

  async function pausedSession(): Promise<string> {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
    const started = sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
    await vi.runAllTimersAsync();
    await started;
    dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');
    await vi.runAllTimersAsync();
    expect((sessionManager.getSession(session.id) as ManagedSession).state).toBe(SessionState.PAUSED);
    snapshotFails.armed = true;
    return session.id;
  }

  it('is named answer-failed, has no row, and fails strict mode after the gate wrote as today', async () => {
    const id = await pausedSession();
    const step = sessionManager.stepOver(id);
    const settled = step.catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    expect(await settled).toBeInstanceOf(StateShadowError);
    expect((sessionManager.getSession(id) as ManagedSession).state).toBe(SessionState.ERROR);
    expect(takeStrictFailures()).toEqual([
      expect.objectContaining({ outcome: 'no-row', site: 'step.failed', event: 'answer-failed', from: 'paused', actual: 'failed' })
    ]);
  });

  it('in record mode the answer is today\'s, and the write is reported', async () => {
    vi.stubEnv('MCP_STATE_SHADOW', 'record');
    const id = await pausedSession();
    const step = sessionManager.stepOver(id);
    await vi.runAllTimersAsync();
    const result = await step;
    expect(result).toMatchObject({ success: false, error: 'reading the answer failed (injected)', state: SessionState.ERROR });
    expect(internals(sessionManager).stateShadow.mismatches().at(-1)).toMatchObject({
      outcome: 'no-row', site: 'step.failed', event: 'answer-failed', why: 'no row for answer-failed from paused'
    });
  });
});

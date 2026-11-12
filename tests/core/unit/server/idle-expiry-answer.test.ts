/**
 * What an agent can see of the idle policy (issue #1025, step 2). The policy is
 * the operator's opt-in, and when it is on it ends programs, so the agent must
 * be able to see it coming and understand it afterwards: `list_debug_sessions`
 * shows how long each session has sat idle and, with a policy on, how long it
 * has left; a tool call naming a session the policy closed says so — when,
 * under which window, and what became of the program — where it used to answer
 * "Session not found", the same words as a mistyped id; and the server
 * instructions mention the policy only when one is in force.
 *
 * Real dispatch over the real SessionManager and store (mock proxy).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DebugLanguage } from '@debugmcp/shared';
import { DebugMcpServer } from '../../../../src/server.js';
import { registerToolHandlers } from '../../../../src/server/tool-dispatch.js';
import { createProductionDependencies, type Dependencies } from '../../../../src/container/dependencies.js';
import { createMockDependencies } from '../session/session-manager-test-utils.js';
import { describeIdleExpiry, type IdleExpiryRecord } from '../../../../src/session/idle-policy.js';

vi.mock('../../../../src/container/dependencies.js');

const WINDOW = 5 * 60_000;
const NOBODY = '00000000-0000-4000-8000-000000000000';

type Handler = (request: unknown, callCtx?: unknown) => Promise<{ content: Array<{ text: string }> }>;

const callCtxFor = (clientId?: string) => ({
  mcpReq: { signal: new AbortController().signal },
  ...(clientId !== undefined ? { http: { authInfo: { clientId, token: 't', scopes: [] } } } : {})
});

describe('what an agent sees of the idle policy (issue #1025, step 2)', () => {
  let core: DebugMcpServer;
  let dependencies: ReturnType<typeof createMockDependencies>;
  let callTool: Handler;

  function build(): void {
    dependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(dependencies as unknown as Dependencies);
    core = new DebugMcpServer();
    let handler: Handler | undefined;
    registerToolHandlers({
      setRequestHandler: (method: string, registered: Handler) => {
        if (method === 'tools/call') handler = registered;
      }
    } as never, core);
    callTool = handler!;
  }

  async function answer(name: string, args: Record<string, unknown>, clientId?: string): Promise<Record<string, unknown>> {
    const raw = await callTool({ method: 'tools/call', params: { name, arguments: args } }, callCtxFor(clientId));
    return JSON.parse(raw.content[0].text) as Record<string, unknown>;
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.parse('2026-11-10T12:00:00.000Z'));
  });

  afterEach(async () => {
    await core?.sessionManager.closeAllSessions().catch(() => undefined);
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('a session the policy closed', () => {
    async function expire(ownerKey?: string): Promise<string> {
      const session = await core.sessionManager.createSession({ language: DebugLanguage.MOCK, ...(ownerKey ? { ownerKey } : {}) });
      vi.setSystemTime(Date.now() + WINDOW + 60_000);
      await core.sessionManager.sweepIdle(WINDOW);
      expect(core.sessionManager.getSession(session.id)).toBeUndefined();
      return session.id;
    }

    it('answers what happened to it instead of "Session not found"', async () => {
      build();
      const id = await expire();

      const result = await answer('get_output', { sessionId: id });

      expect(result).toEqual({
        success: false,
        error:
          `Session ${id} was closed by the idle policy at 2026-11-10T12:06:00.000Z: ` +
          'no tool call named it or its tree for 6 min (the window is 5 min, MCP_DEBUG_SESSION_IDLE_MS=300000). ' +
          // The session was never launched: the answer does not claim a program was ended.
          'It had no running program by then. Create a new session to continue.',
        closedBy: 'idle-policy'
      });
    });

    describe('the sentence', () => {
      const record = (patch: Partial<IdleExpiryRecord>): IdleExpiryRecord => ({
        sessionId: 's1',
        rootId: 's1',
        closedAt: Date.parse('2026-11-10T12:06:00.000Z'),
        idleMs: 360_000,
        windowMs: 300_000,
        outcome: 'ended',
        ...patch
      });

      it('says what the close did to the program, one sentence per outcome', () => {
        expect(describeIdleExpiry(record({ outcome: 'ended' }))).toContain(' Its program was ended. ');
        expect(describeIdleExpiry(record({ outcome: 'released' }))).toContain(' The process it was attached to was released and keeps running. ');
        expect(describeIdleExpiry(record({ outcome: 'closed' }))).toContain(' It had no running program by then. ');
      });

      it('states the idle time in the unit of the window, never a mix', () => {
        // A window in whole minutes: the idle time is minutes too (390 s is not "390 s").
        expect(describeIdleExpiry(record({ idleMs: 390_000 }))).toContain('for 6 min (the window is 5 min,');
        // A window in seconds: so is the idle time.
        expect(describeIdleExpiry(record({ idleMs: 100_400, windowMs: 90_000 }))).toContain('for 100 s (the window is 90 s,');
      });

      it('names the root for a child the expiry took with it', () => {
        expect(describeIdleExpiry(record({ sessionId: 'c1', rootId: 's1' }))).toContain('Session c1 (in the tree of s1) was closed by the idle policy');
      });
    });

    it.each(['step_over', 'wait_for_stop', 'close_debug_session', 'list_breakpoints'])('%s says it the same way', async (tool) => {
      build();
      const id = await expire();

      const result = await answer(tool, { sessionId: id });

      expect(result).toMatchObject({ success: false, closedBy: 'idle-policy' });
      expect(result.error).toContain('was closed by the idle policy');
    });

    it('is told only inside the owner scope: a stranger gets the tool\'s own unknown-id answer', async () => {
      build();
      const id = await expire('agent-b');

      const forStranger = await answer('get_output', { sessionId: id }, 'agent-a');
      const forNobody = await answer('get_output', { sessionId: NOBODY }, 'agent-a');

      expect(JSON.stringify(forStranger).split(id).join('<id>')).toBe(JSON.stringify(forNobody).split(NOBODY).join('<id>'));
      expect(await answer('get_output', { sessionId: id }, 'agent-b')).toMatchObject({ closedBy: 'idle-policy' });
    });

    it('a session that never existed still answers as it always did', async () => {
      build();

      expect(await answer('get_output', { sessionId: NOBODY })).toEqual({ success: false, error: `Session not found: ${NOBODY}` });
    });
  });

  // Issue #1127: a call used to count as activity only at the moment it was
  // dispatched, so a call that outlasted the window (a slow launch, a long
  // attach verify) had its session closed underneath it. The rule now: the
  // clock runs from the END of the last call naming the tree, and a call in
  // flight holds it — every tool that takes the id, not wait_for_stop alone.
  describe('a call in flight (issue #1127)', () => {
    function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
      let resolve!: (value: T) => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
      return { promise, resolve, reject };
    }
    /** Real macrotask turns: only Date is faked here, so every queued continuation runs. */
    const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
    const paused = { success: true, state: 'running' } as never;

    /** A session whose pause_execution stays in flight until the gate settles. */
    async function sessionWithACallInFlight(): Promise<{ id: string; gate: ReturnType<typeof deferred<never>>; call: Promise<Record<string, unknown>> }> {
      const session = await core.sessionManager.createSession({ language: DebugLanguage.MOCK });
      const gate = deferred<never>();
      vi.spyOn(core.sessionManager, 'pause').mockReturnValue(gate.promise);
      const call = answer('pause_execution', { sessionId: session.id });
      await turn();
      expect(core.sessionManager.pause).toHaveBeenCalled();
      return { id: session.id, gate, call };
    }

    it('holds its tree: the sweep does not close a session underneath its own call', async () => {
      build();
      const { id, gate, call } = await sessionWithACallInFlight();
      vi.setSystemTime(Date.now() + WINDOW + 60_000);

      expect(await core.sessionManager.sweepIdle(WINDOW)).toEqual([]);
      expect(core.sessionManager.getSession(id)).toBeDefined();

      gate.resolve(paused);
      expect(await call).toMatchObject({ success: true });
    });

    it('restarts the clock when it answers: a slow call does not use up the window', async () => {
      build();
      const { id, gate, call } = await sessionWithACallInFlight();
      vi.setSystemTime(Date.now() + WINDOW + 60_000);
      gate.resolve(paused);
      await call;

      expect(core.sessionManager.idleMsOf(id)).toBe(0);
      vi.setSystemTime(Date.now() + WINDOW - 1000);
      expect(await core.sessionManager.sweepIdle(WINDOW)).toEqual([]);
      vi.setSystemTime(Date.now() + 2000);
      expect(await core.sessionManager.sweepIdle(WINDOW)).toEqual([id]);
    });

    it('releases the hold when the call fails', async () => {
      build();
      const { id, gate, call } = await sessionWithACallInFlight();
      gate.reject(new Error('the adapter went away'));
      await call.catch(() => undefined);
      vi.setSystemTime(Date.now() + WINDOW + 60_000);

      expect(await core.sessionManager.sweepIdle(WINDOW)).toEqual([id]);
    });

    it('is not shown as idle, or as about to expire, while it runs', async () => {
      vi.stubEnv('MCP_DEBUG_SESSION_IDLE_MS', String(WINDOW));
      build();
      const { id, gate, call } = await sessionWithACallInFlight();
      vi.setSystemTime(Date.now() + WINDOW + 60_000);

      const listed = await answer('list_debug_sessions', {});

      const row = (listed.sessions as Array<Record<string, unknown>>).find((entry) => entry.id === id)!;
      expect(row).toMatchObject({ idleMs: 0, expiresInMs: WINDOW });
      gate.resolve(paused);
      await call;
    });

    // create_debug_session with an attach target runs the attach inside the
    // call, and the call names no session — the dispatch has nothing to hold.
    // The same bug on a second path: an 800 ms window closed the new session
    // under its own attach ("Created session but attach failed: … Proxy exited
    // during initialization").
    describe('create_debug_session with an attach target', () => {
      async function createWithItsAttachInFlight(): Promise<{ id: string; gate: ReturnType<typeof deferred<never>>; call: Promise<Record<string, unknown>> }> {
        const gate = deferred<never>();
        const attach = vi.spyOn(core.sessionManager, 'attachToProcess').mockReturnValue(gate.promise);
        const call = answer('create_debug_session', { language: 'mock', port: 5678 });
        for (let turns = 0; turns < 50 && attach.mock.calls.length === 0; turns++) {
          await turn();
        }
        expect(attach).toHaveBeenCalled();
        return { id: attach.mock.calls[0][0], gate, call };
      }
      const attached = { success: true, state: 'paused', data: {} } as never;

      it('holds the session it created while the attach runs', async () => {
        build();
        const { id, gate, call } = await createWithItsAttachInFlight();
        vi.setSystemTime(Date.now() + WINDOW + 60_000);

        expect(core.sessionManager.idleMsOf(id)).toBe(0);
        expect(await core.sessionManager.sweepIdle(WINDOW)).toEqual([]);
        expect(core.sessionManager.getSession(id)).toBeDefined();

        gate.resolve(attached);
        expect(await call).toMatchObject({ success: true, sessionId: id });
      });

      it('restarts the clock when it answers, and lets go of the session', async () => {
        build();
        const { id, gate, call } = await createWithItsAttachInFlight();
        vi.setSystemTime(Date.now() + WINDOW + 60_000);
        gate.resolve(attached);
        await call;

        expect(core.sessionManager.idleMsOf(id)).toBe(0);
        vi.setSystemTime(Date.now() + WINDOW + 1000);
        expect(await core.sessionManager.sweepIdle(WINDOW)).toEqual([id]);
      });

      it('lets go of the session when the attach throws', async () => {
        build();
        const { id, gate, call } = await createWithItsAttachInFlight();
        gate.reject(new Error('nothing is listening'));
        expect(await call).toMatchObject({ success: false, sessionId: id });
        vi.setSystemTime(Date.now() + WINDOW + 60_000);

        expect(await core.sessionManager.sweepIdle(WINDOW)).toEqual([id]);
      });
    });

    it('restarts the clock of the tree when the call closed the session it named: closing a child is activity for its root', async () => {
      build();
      const root = await core.sessionManager.createSession({ language: DebugLanguage.MOCK });
      const child = (core.sessionManager as unknown as {
        sessionStore: { createSession(params: Record<string, unknown>): { id: string } };
      }).sessionStore.createSession({ language: DebugLanguage.MOCK, name: 'child', parentSessionId: root.id });
      const gate = deferred<void>();
      const close = core.sessionManager.closeSessionReporting.bind(core.sessionManager);
      vi.spyOn(core.sessionManager, 'closeSessionReporting').mockImplementation(async (sessionId: string) => {
        await gate.promise;
        return close(sessionId);
      });

      const call = answer('close_debug_session', { sessionId: child.id });
      await turn();
      vi.setSystemTime(Date.now() + 60_000);
      gate.resolve();
      expect(await call).toMatchObject({ success: true });

      expect(core.sessionManager.getSession(child.id)).toBeUndefined();
      // The slow close just answered: the root has been idle for no time at all.
      expect(core.sessionManager.idleMsOf(root.id)).toBe(0);
    });

    describe('arriving while the policy is closing its session', () => {
      /** An idle sweep whose close of the session stays in flight until the gate opens. */
      async function sweepHeldAtTheClose(ownerKey?: string): Promise<{ id: string; open: () => void; sweep: Promise<string[]> }> {
        const session = await core.sessionManager.createSession({ language: DebugLanguage.MOCK, ...(ownerKey ? { ownerKey } : {}) });
        const gate = deferred<void>();
        const close = core.sessionManager.closeSessionReporting.bind(core.sessionManager);
        vi.spyOn(core.sessionManager, 'closeSessionReporting').mockImplementation(async (sessionId: string) => {
          await gate.promise;
          return close(sessionId);
        });
        vi.setSystemTime(Date.now() + WINDOW + 60_000);
        const sweep = core.sessionManager.sweepIdle(WINDOW);
        await turn();
        return { id: session.id, open: () => gate.resolve(), sweep };
      }

      it('waits for the close and says what happened, where it used to run against a session being torn down', async () => {
        build();
        const { id, open, sweep } = await sweepHeldAtTheClose();
        let settled = false;
        const call = answer('get_output', { sessionId: id }).finally(() => { settled = true; });
        await turn();
        const settledDuringTheClose = settled;

        open();
        await sweep;

        expect(settledDuringTheClose).toBe(false);
        expect(await call).toMatchObject({ success: false, closedBy: 'idle-policy' });
      });

      it('does not make a stranger wait on a child whose row the cascade already removed: no timing tells it the id was real', async () => {
        build();
        const root = await core.sessionManager.createSession({ language: DebugLanguage.MOCK, ownerKey: 'agent-b' });
        const child = (core.sessionManager as unknown as {
          sessionStore: { createSession(params: Record<string, unknown>): { id: string } };
        }).sessionStore.createSession({ language: DebugLanguage.MOCK, name: 'child', parentSessionId: root.id, ownerKey: 'agent-b' });
        const gate = deferred<void>();
        const close = core.sessionManager.closeSessionReporting.bind(core.sessionManager);
        vi.spyOn(core.sessionManager, 'closeSessionReporting').mockImplementation(async (sessionId: string) => {
          const report = await close(sessionId);
          // The rows are gone; the sweep has not finished with the tree yet.
          await gate.promise;
          return report;
        });
        vi.setSystemTime(Date.now() + WINDOW + 60_000);
        const sweep = core.sessionManager.sweepIdle(WINDOW);
        for (let turns = 0; turns < 50 && core.sessionManager.getSession(child.id); turns++) {
          await turn();
        }
        expect(core.sessionManager.getSession(child.id)).toBeUndefined();

        let strangerAnswered = false;
        const forStranger = answer('get_output', { sessionId: child.id }, 'agent-a').finally(() => { strangerAnswered = true; });
        let ownerAnswered = false;
        const forOwner = answer('get_output', { sessionId: child.id }, 'agent-b').finally(() => { ownerAnswered = true; });
        await turn();
        const answeredDuringTheClose = { stranger: strangerAnswered, owner: ownerAnswered };
        gate.resolve();
        await sweep;

        expect(answeredDuringTheClose).toEqual({ stranger: true, owner: false });
        expect(await forStranger).toEqual({ success: false, error: `Session not found: ${child.id}` });
        expect(await forOwner).toMatchObject({ success: false, closedBy: 'idle-policy' });
      });

      it('does not make a caller outside the owner scope wait: for it the id is unknown, as before', async () => {
        build();
        const { id, open, sweep } = await sweepHeldAtTheClose('agent-b');

        const forStranger = await answer('get_output', { sessionId: id }, 'agent-a');
        const forNobody = await answer('get_output', { sessionId: NOBODY }, 'agent-a');

        expect(JSON.stringify(forStranger).split(id).join('<id>')).toBe(JSON.stringify(forNobody).split(NOBODY).join('<id>'));
        open();
        await sweep;
      });
    });
  });

  describe('list_debug_sessions', () => {
    it('shows how long each session has gone without a tool call; no expiry when the policy is off', async () => {
      build();
      const session = await core.sessionManager.createSession({ language: DebugLanguage.MOCK });
      vi.setSystemTime(Date.now() + 10_000);

      const listed = await answer('list_debug_sessions', {});

      const row = (listed.sessions as Array<Record<string, unknown>>).find((entry) => entry.id === session.id)!;
      expect(row.idleMs).toBe(10_000);
      expect(row).not.toHaveProperty('expiresInMs');
    });

    it('adds the time each session has left when the operator turned the policy on', async () => {
      vi.stubEnv('MCP_DEBUG_SESSION_IDLE_MS', String(WINDOW));
      build();
      const session = await core.sessionManager.createSession({ language: DebugLanguage.MOCK });
      vi.setSystemTime(Date.now() + 10_000);

      const listed = await answer('list_debug_sessions', {});

      const row = (listed.sessions as Array<Record<string, unknown>>).find((entry) => entry.id === session.id)!;
      expect(row).toMatchObject({ idleMs: 10_000, expiresInMs: WINDOW - 10_000 });
    });

    it('never shows a negative time left', async () => {
      vi.stubEnv('MCP_DEBUG_SESSION_IDLE_MS', String(WINDOW));
      build();
      const session = await core.sessionManager.createSession({ language: DebugLanguage.MOCK });
      vi.setSystemTime(Date.now() + WINDOW * 2);

      const listed = await answer('list_debug_sessions', {});

      const row = (listed.sessions as Array<Record<string, unknown>>).find((entry) => entry.id === session.id)!;
      expect(row.expiresInMs).toBe(0);
    });
  });

  describe('the server instructions', () => {
    it('say nothing of the policy when it is off', () => {
      build();

      expect(core.instructions).not.toMatch(/idle/i);
    });

    it('state the window and what expiry does when it is on', () => {
      vi.stubEnv('MCP_DEBUG_SESSION_IDLE_MS', String(WINDOW));
      build();

      expect(core.instructions).toContain(
        'This server closes a debug session tree that no tool call has named for 5 min'
      );
      expect(core.instructions).toContain('expiresInMs');
    });
  });
});

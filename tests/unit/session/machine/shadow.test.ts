/**
 * The shadow check on its own (src/session/machine/shadow.ts): what it records
 * for a gate call or a note, what strict mode throws and what it never throws,
 * that a strict failure is queued before anything that can fail, the facts
 * taken at the write, the per-session bookkeeping its guards read, and its
 * bounded ring.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import { SessionLifecycleState, SessionState } from '@debugmcp/shared';
import {
  StateShadow,
  StateShadowError,
  shadowCounts,
  shadowMode,
  shadowRowHits,
  takeStrictFailures,
  type ShadowSession
} from '../../../../src/session/machine/shadow.js';
import { TEST_SETUP_WRITE, type StateWrite } from '../../../../src/session/machine/transition-table.js';

interface FakeSession { id: string; state: SessionState; lastStop?: object; parentSessionId?: string }

type FakeLogger = { warn: ReturnType<typeof vi.fn>; debug: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

function makeShadow(options: { descendants?: number; ringSize?: number; root?: ShadowSession; logger?: FakeLogger } = {}) {
  const logger = options.logger ?? { warn: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() };
  const shadow = new StateShadow({
    logger: () => logger as never,
    descendantsOf: () => options.descendants ?? 0,
    ...(options.root ? { rootOf: () => options.root! } : {}),
    ...(options.ringSize ? { ringSize: options.ringSize } : {})
  });
  return { shadow, logger };
}

/** A gate call as the gate makes it: the facts, the write (and its listeners), then the check. */
function gate(
  shadow: StateShadow,
  session: FakeSession,
  next: SessionState,
  write: StateWrite | typeof TEST_SETUP_WRITE | undefined,
  listener?: () => void
): void {
  const from = session.state;
  const boundary = shadow.begin(session, write as StateWrite);
  session.state = next;
  listener?.();
  shadow.check(session, from, next, write as StateWrite, boundary);
}

function registryOf(): { harness?: boolean; pending?: unknown[] } {
  return (globalThis as unknown as Record<symbol, { harness?: boolean; pending?: unknown[] }>)[Symbol.for('mcp-debugger.state-shadow')];
}

describe('the state shadow', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    takeStrictFailures();
  });

  it('runs strict in the unit project, with the harness registered', () => {
    expect(process.env.MCP_STATE_SHADOW).toBe('strict');
    expect(shadowMode()).toBe('strict');
    expect(registryOf().harness).toBe(true);
  });

  it('reads the mode on every call: record by default, off, strict', () => {
    vi.stubEnv('MCP_STATE_SHADOW', '');
    expect(shadowMode()).toBe('record');
    vi.stubEnv('MCP_STATE_SHADOW', 'something');
    expect(shadowMode()).toBe('record');
    vi.stubEnv('MCP_STATE_SHADOW', 'off');
    expect(shadowMode()).toBe('off');
  });

  it('records a legal transition with its session, run, phases, event, site and row', () => {
    const { shadow, logger } = makeShadow();
    const session: FakeSession = { id: 's1', state: SessionState.CREATED };
    gate(shadow, session, SessionState.INITIALIZING, { site: 'launch', event: 'start' });
    gate(shadow, session, SessionState.RUNNING, { site: 'handleAdapterConfigured', event: 'adapter-configured', facts: { stopOnEntry: false } });
    expect(shadow.counts()).toEqual({ legal: 2 });
    expect(shadow.countsByKey().get('legal|launch|start|created|starting')).toBe(1);
    expect(shadow.countsByKey().get('legal|handleAdapterConfigured|adapter-configured|starting|running')).toBe(1);
    expect(Object.fromEntries(shadow.rowHits())).toEqual({ 'start': 1, 'adapter-configured': 1 });
    expect(shadowRowHits().get('start')).toBeGreaterThanOrEqual(1);
    expect(shadow.runOf(session)).toBe(1);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(shadow.mismatches()).toEqual([]);
    expect(shadowCounts().get('legal|launch|start|created|starting')).toBeGreaterThanOrEqual(1);
  });

  it('throws on no-row in strict mode only, after recording it, and queues it for the harness', () => {
    const { shadow, logger } = makeShadow();
    const session: FakeSession = { id: 's2', state: SessionState.STOPPED };
    expect(() => gate(shadow, session, SessionState.RUNNING, { site: 'handleContinued', event: 'continued' }))
      .toThrow(StateShadowError);
    expect(shadow.counts()['no-row']).toBe(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toContain('no-row: session s2 run 0 ended --continued--> running at handleContinued');
    const queued = takeStrictFailures();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ outcome: 'no-row', site: 'handleContinued', from: 'ended', actual: 'running' });

    vi.stubEnv('MCP_STATE_SHADOW', 'record');
    session.state = SessionState.STOPPED;
    expect(() => gate(shadow, session, SessionState.RUNNING, { site: 'handleContinued', event: 'continued' })).not.toThrow();
    expect(shadow.counts()['no-row']).toBe(2);
    expect(takeStrictFailures()).toEqual([]);
  });

  it('queues a strict failure before logging it: a logger that throws cannot lose it', () => {
    const throwing: FakeLogger = { warn: vi.fn(() => { throw new Error('logger down'); }), debug: vi.fn(), info: vi.fn(), error: vi.fn() };
    const { shadow } = makeShadow({ logger: throwing });
    const session: FakeSession = { id: 's2b', state: SessionState.STOPPED };
    // The caller swallows the throw, as code under test may.
    let thrown: unknown;
    try {
      gate(shadow, session, SessionState.RUNNING, { site: 'handleContinued', event: 'continued' });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(StateShadowError);
    expect(throwing.warn).toHaveBeenCalledTimes(1);
    expect(session.state).toBe(SessionState.RUNNING);
    expect(takeStrictFailures().map((r) => `${r.outcome} ${r.from} -> ${r.actual}`)).toEqual(['no-row ended -> running']);
    expect(shadow.counts()['no-row']).toBe(1);
  });

  it('queues a fault of its own even when the logger throws too', () => {
    const throwing: FakeLogger = { warn: vi.fn(() => { throw new Error('logger down'); }), debug: vi.fn(), info: vi.fn(), error: vi.fn() };
    const { shadow } = makeShadow({ logger: throwing });
    (shadow as unknown as { evaluate: () => never }).evaluate = () => { throw new Error('injected'); };
    const session: FakeSession = { id: 's2c', state: SessionState.CREATED };
    expect(() => gate(shadow, session, SessionState.INITIALIZING, { site: 'launch', event: 'start' })).not.toThrow();
    expect(takeStrictFailures()).toEqual([expect.objectContaining({ outcome: 'internal-error', site: 'launch', why: 'injected' })]);
  });

  it('queues nothing outside a harness: a strict process with nobody to drain the queue', () => {
    const registry = registryOf();
    const wasHarness = registry.harness;
    try {
      registry.harness = false;
      vi.stubEnv('MCP_STATE_SHADOW_LOG', '');
      const { shadow } = makeShadow();
      const session: FakeSession = { id: 's2d', state: SessionState.STOPPED };
      expect(() => gate(shadow, session, SessionState.RUNNING, { site: 'handleContinued', event: 'continued' })).toThrow(StateShadowError);
      expect(takeStrictFailures()).toEqual([]);
    } finally {
      registry.harness = wasHarness;
    }
  });

  it('never throws on guard-not-met, unevaluated or legacy, in any mode', () => {
    const { shadow, logger } = makeShadow();
    const session: FakeSession = { id: 's3', state: SessionState.RUNNING };
    // legacy: the transient pause
    session.lastStop = { reason: 'entry' };
    expect(() => gate(shadow, session, SessionState.PAUSED, { site: 'settleStop.hidden', event: 'stop-hidden' })).not.toThrow();
    // unevaluated: a refusal with no token
    session.state = SessionState.RUNNING;
    expect(() => gate(shadow, session, SessionState.PAUSED, { site: 'continue.rejected', event: 'resume-refused' })).not.toThrow();
    // guard-not-met: a refusal from a stop that is gone
    session.state = SessionState.RUNNING;
    const since = { runId: 0, continued: 0, fromStop: { reason: 'old' } };
    expect(() => gate(shadow, session, SessionState.PAUSED, { site: 'continue.rejected', event: 'resume-refused', facts: { since } })).not.toThrow();
    expect(shadow.counts()).toEqual({ legacy: 1, unevaluated: 1, 'guard-not-met': 1 });
    // only the row that vouched for a write counts as matched
    expect(Object.fromEntries(shadow.rowHits())).toEqual({ 'stop-hidden': 1 });
    // one warn line per mismatch; legacy is a debug line
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(takeStrictFailures()).toEqual([]);
  });

  it('judges a call that names no event, or the wrong event for its site, as no-row', () => {
    vi.stubEnv('MCP_STATE_SHADOW', 'record');
    const { shadow } = makeShadow();
    const session: FakeSession = { id: 's4', state: SessionState.PAUSED, lastStop: {} };
    gate(shadow, session, SessionState.RUNNING, undefined);
    session.state = SessionState.PAUSED;
    gate(shadow, session, SessionState.RUNNING, { site: 'executeStep.sent', event: 'continued' } as unknown as StateWrite);
    const [unnamed, misnamed] = shadow.mismatches();
    expect(unnamed).toMatchObject({ outcome: 'no-row', site: 'unknown', why: 'a state write that names no site or event' });
    expect(misnamed).toMatchObject({ outcome: 'no-row', site: 'executeStep.sent', why: "site 'executeStep.sent' does not name event 'continued'" });
  });

  it('an invalid write clears the phase a noted replacement left, as any write does', () => {
    vi.stubEnv('MCP_STATE_SHADOW', 'record');
    const { shadow } = makeShadow();
    const session: FakeSession = { id: 's4b', state: SessionState.CREATED };
    gate(shadow, session, SessionState.INITIALIZING, { site: 'launch', event: 'start' });
    gate(shadow, session, SessionState.RUNNING, { site: 'handleAdapterConfigured', event: 'adapter-configured', facts: { stopOnEntry: false } });
    shadow.noteReplacement(session, 'launch.replace', { descendants: 0 });
    // an invalid write in between: the public state is what the next write is judged from
    gate(shadow, session, SessionState.RUNNING, { site: 'nowhere', event: 'resume' } as unknown as StateWrite);
    gate(shadow, session, SessionState.PAUSED, { site: 'settleStop.shown', event: 'stop-shown' }, () => undefined);
    expect([...shadow.countsByKey().keys()]).toContain('legal|settleStop.shown|stop-shown|running|paused');
  });

  it('counts a test\'s own state write as test-setup, never against the table', () => {
    const { shadow, logger } = makeShadow();
    const session: FakeSession = { id: 's5', state: SessionState.STOPPED };
    gate(shadow, session, SessionState.RUNNING, TEST_SETUP_WRITE);
    expect(shadow.counts()).toEqual({ 'test-setup': 1 });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('is silent in off mode', () => {
    vi.stubEnv('MCP_STATE_SHADOW', 'off');
    const { shadow } = makeShadow();
    const session: FakeSession = { id: 's6', state: SessionState.STOPPED };
    gate(shadow, session, SessionState.RUNNING, undefined);
    shadow.note(session, { site: 'handleContinued', event: 'continued' });
    shadow.noteReplacement(session, 'launch.replace', shadow.replacementFacts(session));
    shadow.lifecycle(session, SessionLifecycleState.ACTIVE, 'launch');
    expect(shadow.counts()).toEqual({});
  });

  it('takes the guards\' facts at the write: a listener that changes the session does not change the verdict', () => {
    const { shadow } = makeShadow();
    const session: FakeSession = { id: 's6b', state: SessionState.CREATED };
    gate(shadow, session, SessionState.INITIALIZING, { site: 'attach', event: 'start' });
    // A valid attach-verified write with no stop; its state listener installs one.
    gate(shadow, session, SessionState.RUNNING, { site: 'attach.verified', event: 'attach-verified' }, () => {
      session.lastStop = { reason: 'breakpoint' };
    });
    expect(shadow.countsByKey().get('legal|attach.verified|attach-verified|starting|running')).toBe(1);
    expect(shadow.mismatches()).toEqual([]);
  });

  it('keeps the bookkeeping of a write a listener made inside another', () => {
    const { shadow } = makeShadow();
    const shown = { reason: 'breakpoint' };
    const session: FakeSession = { id: 's6c', state: SessionState.RUNNING, lastStop: shown };
    // stop-shown, and inside its listener a newer write: a resume out of it
    gate(shadow, session, SessionState.PAUSED, { site: 'settleStop.shown', event: 'stop-shown' }, () => {
      gate(shadow, session, SessionState.RUNNING, { site: 'continue.sent', event: 'resume' });
    });
    // The state the gate last wrote is the inner write's, not the outer one's,
    // and the outer write still recorded the stop it showed.
    const kept = (shadow as unknown as { perSession: WeakMap<object, { lastWritten?: SessionState; lastShownStop?: object }> })
      .perSession.get(session);
    expect(kept?.lastWritten).toBe(SessionState.RUNNING);
    expect(kept?.lastShownStop).toBe(shown);
    shadow.lifecycle(session, SessionLifecycleState.ACTIVE, 'launch');
    expect(shadow.counts()).toEqual({ legal: 2, 'lifecycle-agrees': 1 });
  });

  it('judges a start after a noted replacement from where the table put the old run', () => {
    const { shadow } = makeShadow();
    const session: FakeSession = { id: 's7', state: SessionState.CREATED };
    gate(shadow, session, SessionState.INITIALIZING, { site: 'launch', event: 'start' });
    gate(shadow, session, SessionState.RUNNING, { site: 'handleAdapterConfigured', event: 'adapter-configured', facts: { stopOnEntry: false } });
    const before = shadow.replacementFacts(session);
    shadow.noteReplacement(session, 'launch.replace', before);
    gate(shadow, session, SessionState.INITIALIZING, { site: 'launch', event: 'start' });
    const keys = [...shadow.countsByKey().keys()];
    expect(keys).toContain('legal|launch.replace|replace|running|ended(note)');
    // judged from the replaced run's ending, not the running state it never left
    expect(keys).toContain('legal|launch|start|ended|starting');
    expect(shadow.runOf(session)).toBe(2);
  });

  it('notes no replacement where nothing is replaced, and one for an ended run whose children were counted before the teardown', () => {
    const ended: FakeSession = { id: 's8', state: SessionState.STOPPED };
    const lone = makeShadow({ descendants: 0 });
    lone.shadow.noteReplacement(ended, 'attach.replace', lone.shadow.replacementFacts(ended));
    expect(lone.shadow.counts()).toEqual({});
    // The teardown closed the two children, so they are gone by the note; the facts taken before say they were there.
    const withChildren = makeShadow({ descendants: 0 });
    withChildren.shadow.noteReplacement(ended, 'attach.replace', { descendants: 2 });
    expect([...withChildren.shadow.countsByKey().keys()]).toEqual(['legal|attach.replace|replace|ended|ended(note)']);
  });

  it('judges a refusal from the token its request took: continued since, and stop identity', () => {
    const { shadow } = makeShadow();
    const stop = { reason: 'breakpoint' };
    const session: FakeSession = { id: 's9', state: SessionState.PAUSED, lastStop: stop };
    // refused before the program resumed: legal
    let token = shadow.token(session);
    gate(shadow, session, SessionState.RUNNING, { site: 'continue.sent', event: 'resume' });
    gate(shadow, session, SessionState.PAUSED, { site: 'continue.rejected', event: 'resume-refused', facts: { since: token } });
    expect(shadow.counts()).toEqual({ legal: 2 });
    // refused after the engine reported continued: guard-not-met
    token = shadow.token(session);
    gate(shadow, session, SessionState.RUNNING, { site: 'continue.sent', event: 'resume' });
    gate(shadow, session, SessionState.RUNNING, { site: 'handleContinued', event: 'continued' });
    gate(shadow, session, SessionState.PAUSED, { site: 'continue.rejected', event: 'resume-refused', facts: { since: token } });
    expect(shadow.counts()['guard-not-met']).toBe(1);
    // unanswered after continued: guard-not-met too; before: the legacy rollback
    token = shadow.token(session);
    gate(shadow, session, SessionState.RUNNING, { site: 'continue.sent', event: 'resume' });
    gate(shadow, session, SessionState.PAUSED, { site: 'continue.rejected', event: 'resume-unanswered', facts: { since: token } });
    expect(shadow.counts().legacy).toBe(1);
    // a stale continued while paused is noted, and counted too
    token = shadow.token(session);
    shadow.note(session, { site: 'handleContinued', event: 'continued' });
    expect(shadow.token(session)?.continued).toBe((token?.continued ?? 0) + 1);
  });

  it('records the direct assignment as a write, judged by the refusal\'s guard', () => {
    const { shadow } = makeShadow();
    const session: FakeSession = { id: 's10', state: SessionState.PAUSED, lastStop: undefined };
    const token = shadow.token(session);
    session.state = SessionState.RUNNING;
    const from = session.state;
    session.state = SessionState.PAUSED;
    shadow.note(session, { site: 'executeStep.refused-unrecorded', event: 'resume-refused', facts: { since: token } }, { from });
    expect(shadow.mismatches()[0]).toMatchObject({
      outcome: 'guard-not-met',
      site: 'executeStep.refused-unrecorded',
      from: 'running',
      actual: 'paused',
      note: true,
      guard: 'refused-before-resume'
    });
  });

  it('asserts each lifecycle write against the state the gate last wrote', () => {
    const { shadow } = makeShadow();
    const session: FakeSession = { id: 's11', state: SessionState.CREATED };
    gate(shadow, session, SessionState.INITIALIZING, { site: 'launch', event: 'start' });
    shadow.lifecycle(session, SessionLifecycleState.ACTIVE, 'launch');
    expect(shadow.counts()['lifecycle-agrees']).toBe(1);
    expect(() => shadow.lifecycle(session, SessionLifecycleState.TERMINATED, 'launch')).toThrow(StateShadowError);
    expect(shadow.counts()['lifecycle-disagrees']).toBe(1);
    expect(takeStrictFailures()).toHaveLength(1);
  });

  it('a child records under its root\'s run', () => {
    const root: FakeSession = { id: 'root', state: SessionState.CREATED };
    const { shadow } = makeShadow({ root });
    gate(shadow, root, SessionState.INITIALIZING, { site: 'launch', event: 'start' });
    const child: FakeSession = { id: 'child', state: SessionState.CREATED, parentSessionId: 'root' };
    gate(shadow, child, SessionState.RUNNING, { site: 'adoptReportedChild', event: 'adopt' });
    expect(shadow.runOf(child)).toBe(1);
  });

  it('keeps a bounded ring of mismatches', () => {
    vi.stubEnv('MCP_STATE_SHADOW', 'record');
    const { shadow } = makeShadow({ ringSize: 3 });
    const session: FakeSession = { id: 's12', state: SessionState.STOPPED };
    for (let i = 0; i < 5; i++) {
      session.state = SessionState.STOPPED;
      gate(shadow, session, SessionState.RUNNING, { site: 'handleContinued', event: 'continued' });
    }
    expect(shadow.counts()['no-row']).toBe(5);
    expect(shadow.mismatches()).toHaveLength(3);
  });

  it('swallows a fault of its own and records it, in every mode', () => {
    const { shadow, logger } = makeShadow();
    (shadow as unknown as { evaluate: () => never }).evaluate = () => { throw new Error('injected'); };
    const session: FakeSession = { id: 's13', state: SessionState.CREATED };
    expect(() => gate(shadow, session, SessionState.INITIALIZING, { site: 'launch', event: 'start' })).not.toThrow();
    expect(shadow.counts()['internal-error']).toBe(1);
    expect(logger.warn.mock.calls[0][0]).toContain('internal-error');
    // strict mode queues it for the harness rather than throwing
    expect(takeStrictFailures().map((r) => r.outcome)).toEqual(['internal-error']);
  });

  it('writes one ndjson line per verdict in a process the harness does not own', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'state-shadow-'));
    const registry = registryOf();
    const wasHarness = registry.harness;
    try {
      registry.harness = false;
      vi.stubEnv('MCP_STATE_SHADOW_LOG', dir);
      const { shadow } = makeShadow();
      const session: FakeSession = { id: 's14', state: SessionState.CREATED };
      gate(shadow, session, SessionState.INITIALIZING, { site: 'launch', event: 'start' });
      const [file] = readdirSync(dir);
      expect(file).toBe(`state-shadow-${process.pid}.ndjson`);
      const lines = readFileSync(path.join(dir, file), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
      expect(lines).toEqual([expect.objectContaining({ outcome: 'legal', sessionId: 's14', site: 'launch', event: 'start', from: 'created', actual: 'starting', row: 'start' })]);
    } finally {
      registry.harness = wasHarness;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

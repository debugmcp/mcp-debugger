/**
 * The shadow check on its own (src/session/machine/shadow.ts): what it records
 * for a gate call or a note, what strict mode throws and what it never throws,
 * the per-session bookkeeping its guards read, and its bounded ring.
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
  takeStrictFailures,
  type ShadowSession
} from '../../../../src/session/machine/shadow.js';
import { TEST_SETUP_WRITE, type StateWrite } from '../../../../src/session/machine/transition-table.js';

interface FakeSession { id: string; state: SessionState; lastStop?: object; parentSessionId?: string }

function makeShadow(options: { descendants?: number; ringSize?: number; root?: ShadowSession } = {}) {
  const logger = { warn: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() };
  const shadow = new StateShadow({
    logger: () => logger as never,
    descendantsOf: () => options.descendants ?? 0,
    ...(options.root ? { rootOf: () => options.root! } : {}),
    ...(options.ringSize ? { ringSize: options.ringSize } : {})
  });
  return { shadow, logger };
}

/** A gate call: write the state, then check, as the gate does. */
function gate(shadow: StateShadow, session: FakeSession, next: SessionState, write: StateWrite | typeof TEST_SETUP_WRITE | undefined): void {
  const from = session.state;
  session.state = next;
  shadow.check(session, from, next, write as StateWrite);
}

describe('the state shadow', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    takeStrictFailures();
  });

  it('runs strict in the unit project', () => {
    expect(process.env.MCP_STATE_SHADOW).toBe('strict');
    expect(shadowMode()).toBe('strict');
  });

  it('reads the mode on every call: record by default, off, strict', () => {
    vi.stubEnv('MCP_STATE_SHADOW', '');
    expect(shadowMode()).toBe('record');
    vi.stubEnv('MCP_STATE_SHADOW', 'something');
    expect(shadowMode()).toBe('record');
    vi.stubEnv('MCP_STATE_SHADOW', 'off');
    expect(shadowMode()).toBe('off');
  });

  it('records a legal transition with its session, run, phases, event and site', () => {
    const { shadow, logger } = makeShadow();
    const session: FakeSession = { id: 's1', state: SessionState.CREATED };
    gate(shadow, session, SessionState.INITIALIZING, { site: 'launch', event: 'start' });
    gate(shadow, session, SessionState.RUNNING, { site: 'handleAdapterConfigured', event: 'adapter-configured', facts: { stopOnEntry: false } });
    expect(shadow.counts()).toEqual({ legal: 2 });
    expect(shadow.countsByKey().get('legal|launch|start|created|starting')).toBe(1);
    expect(shadow.countsByKey().get('legal|handleAdapterConfigured|adapter-configured|starting|running')).toBe(1);
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

  it('never throws on guard-not-met, unevaluated or legacy, in any mode', () => {
    const { shadow, logger } = makeShadow();
    const session: FakeSession = { id: 's3', state: SessionState.RUNNING };
    // legacy: the transient pause
    session.lastStop = { reason: 'entry' };
    expect(() => gate(shadow, session, SessionState.PAUSED, { site: 'settleStop.hidden', event: 'stop-hidden' })).not.toThrow();
    // unevaluated: a refusal with no token
    session.state = SessionState.RUNNING;
    expect(() => gate(shadow, session, SessionState.PAUSED, { site: 'continue.refused', event: 'resume-refused' })).not.toThrow();
    // guard-not-met: a refusal from a stop that is gone
    session.state = SessionState.RUNNING;
    const since = { runId: 0, continued: 0, fromStop: { reason: 'old' } };
    expect(() => gate(shadow, session, SessionState.PAUSED, { site: 'continue.refused', event: 'resume-refused', facts: { since } })).not.toThrow();
    expect(shadow.counts()).toEqual({ legacy: 1, unevaluated: 1, 'guard-not-met': 1 });
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
    shadow.lifecycle(session, SessionLifecycleState.ACTIVE, 'launch');
    expect(shadow.counts()).toEqual({});
  });

  it('judges a start after a noted replacement from where the table put the old run', () => {
    const { shadow } = makeShadow();
    const session: FakeSession = { id: 's7', state: SessionState.CREATED };
    gate(shadow, session, SessionState.INITIALIZING, { site: 'launch', event: 'start' });
    gate(shadow, session, SessionState.RUNNING, { site: 'handleAdapterConfigured', event: 'adapter-configured', facts: { stopOnEntry: false } });
    shadow.noteReplacement(session, 'launch.replace');
    gate(shadow, session, SessionState.INITIALIZING, { site: 'launch', event: 'start' });
    const keys = [...shadow.countsByKey().keys()];
    expect(keys).toContain('legal|launch.replace|replace|running|ended(note)');
    // judged from the replaced run's ending, not the running state it never left
    expect(keys).toContain('legal|launch|start|ended|starting');
    expect(shadow.runOf(session)).toBe(2);
  });

  it('notes no replacement where nothing is replaced, and one for an ended run with children', () => {
    const ended: FakeSession = { id: 's8', state: SessionState.STOPPED };
    const lone = makeShadow({ descendants: 0 });
    lone.shadow.noteReplacement(ended, 'attach.replace');
    expect(lone.shadow.counts()).toEqual({});
    const withChildren = makeShadow({ descendants: 2 });
    withChildren.shadow.noteReplacement(ended, 'attach.replace');
    expect([...withChildren.shadow.countsByKey().keys()]).toEqual(['legal|attach.replace|replace|ended|ended(note)']);
  });

  it('judges a refusal from the token its request took: continued since, and stop identity', () => {
    const { shadow } = makeShadow();
    const stop = { reason: 'breakpoint' };
    const session: FakeSession = { id: 's9', state: SessionState.PAUSED, lastStop: stop };
    // refused before the program resumed: legal
    let token = shadow.token(session);
    gate(shadow, session, SessionState.RUNNING, { site: 'continue.sent', event: 'resume' });
    gate(shadow, session, SessionState.PAUSED, { site: 'continue.refused', event: 'resume-refused', facts: { since: token } });
    expect(shadow.counts()).toEqual({ legal: 2 });
    // refused after the engine reported continued: guard-not-met
    token = shadow.token(session);
    gate(shadow, session, SessionState.RUNNING, { site: 'continue.sent', event: 'resume' });
    gate(shadow, session, SessionState.RUNNING, { site: 'handleContinued', event: 'continued' });
    gate(shadow, session, SessionState.PAUSED, { site: 'continue.refused', event: 'resume-refused', facts: { since: token } });
    expect(shadow.counts()['guard-not-met']).toBe(1);
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
    const registry = (globalThis as unknown as Record<symbol, { harness?: boolean }>)[Symbol.for('mcp-debugger.state-shadow')];
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
      expect(lines).toEqual([expect.objectContaining({ outcome: 'legal', sessionId: 's14', site: 'launch', event: 'start', from: 'created', actual: 'starting' })]);
    } finally {
      registry.harness = wasHarness;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

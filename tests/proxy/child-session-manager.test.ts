/**
 * Tests for ChildSessionManager - validates child session management abstraction
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { AdapterPolicy } from '@debugmcp/shared';
import { JsDebugAdapterPolicy, PythonAdapterPolicy, DefaultAdapterPolicy } from '@debugmcp/shared';
import { ChildSessionManager } from '../../src/proxy/child-session-manager.js';
// Mock MinimalDapClient
class MockMinimalDapClient extends EventEmitter {
  // Knobs for death-aware adoption tests (issue #248); reset in beforeEach
  static lastInstance: MockMinimalDapClient | null = null;
  // All clients created in order — a release (issue #501) creates a second
  // client, so lastInstance alone cannot address the adoption child
  static instances: MockMinimalDapClient[] = [];
  static hangCommands = new Set<string>();
  static failCommands = new Map<string, Error>();
  static suppressInitialized = false;
  // When set, returned verbatim for setBreakpoints; otherwise a verified
  // breakpoint per requested line with child-space ids (100, 101, ...)
  static setBreakpointsResponse: unknown | undefined = undefined;
  // Per-call setBreakpoints responses, shifted in order; takes precedence
  // over setBreakpointsResponse until exhausted (drives the forceFreshEcho
  // clear+reset sequence, issue #500)
  static setBreakpointsResponses: unknown[] = [];
  // Emit a stopped event shortly after the attach request (issue #295 —
  // simulates the entry stop firing while later adoption steps still run)
  static emitStoppedAfterAttach = false;
  // Emit a post-attach 'initialized' (some adapters re-initialize after
  // attach; drives handlePostAttachInit's replay path)
  static emitInitializedAfterAttach = false;
  // Commands that emit 'initialized' synchronously during sendRequest, i.e.
  // before the caller's await resumes — models the event arriving in the same
  // socket chunk as the response (issue #529)
  static emitInitializedSyncOn = new Set<string>();
  // When set, returned verbatim for 'threads'
  static threadsResponse: unknown | undefined = undefined;
  // When true, shutdown() throws (drives the parent shutdown catch arm)
  static shutdownThrows = false;

  host: string;
  port: number;
  policy?: AdapterPolicy;
  options?: { traceLabel?: string };
  connected = false;
  requests: Array<{ command: string; args: unknown }> = [];
  shutdownCalls: string[] = [];

  constructor(host: string, port: number, policy?: AdapterPolicy, options?: { traceLabel?: string }) {
    super();
    this.host = host;
    this.port = port;
    this.policy = policy;
    this.options = options;
    MockMinimalDapClient.lastInstance = this;
    MockMinimalDapClient.instances.push(this);
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async sendRequest(command: string, args?: unknown, _timeoutMs?: number): Promise<any> {
    this.requests.push({ command, args });

    if (MockMinimalDapClient.hangCommands.has(command)) {
      return new Promise(() => {});
    }
    const failure = MockMinimalDapClient.failCommands.get(command);
    if (failure) {
      throw failure;
    }

    if (command === 'attach' && MockMinimalDapClient.emitStoppedAfterAttach) {
      setTimeout(() => this.emit('event', { event: 'stopped', body: { reason: 'entry', threadId: 0 } }), 5);
    }
    if (command === 'attach' && MockMinimalDapClient.emitInitializedAfterAttach) {
      setTimeout(() => this.emit('event', { event: 'initialized' }), 5);
    }
    if (MockMinimalDapClient.emitInitializedSyncOn.has(command)) {
      // Same-chunk semantics (issue #529): the real client dispatches an event
      // that shares a socket chunk with the response synchronously, while the
      // response's awaiter is still parked in the microtask queue — so a
      // listener registered after `await sendRequest(...)` never sees it.
      this.emit('event', { event: 'initialized' });
    }

    // Simulate responses
    if (command === 'initialize') {
      if (!MockMinimalDapClient.suppressInitialized) {
        setTimeout(() => this.emit('event', { event: 'initialized' }), 10);
      }
      return { body: { capabilities: {} } };
    }
    if (command === 'threads') {
      if (MockMinimalDapClient.threadsResponse !== undefined) {
        return MockMinimalDapClient.threadsResponse;
      }
      return { body: { threads: [{ id: 1, name: 'main' }] } };
    }
    if (command === 'setBreakpoints') {
      if (MockMinimalDapClient.setBreakpointsResponses.length > 0) {
        return MockMinimalDapClient.setBreakpointsResponses.shift();
      }
      if (MockMinimalDapClient.setBreakpointsResponse !== undefined) {
        return MockMinimalDapClient.setBreakpointsResponse;
      }
      const a = args as { breakpoints?: DebugProtocol.SourceBreakpoint[] };
      return {
        body: {
          breakpoints: (a?.breakpoints ?? []).map((bp, i) => ({
            id: 100 + i,
            verified: true,
            line: bp.line
          }))
        }
      };
    }
    return {};
  }

  shutdown(reason: string): void {
    this.shutdownCalls.push(reason);
    if (MockMinimalDapClient.shutdownThrows) {
      throw new Error('shutdown exploded');
    }
    this.connected = false;
  }

  disconnect(): void {
    this.connected = false;
  }
}

// Mock the import to avoid circular dependency
vi.mock('../../src/proxy/minimal-dap.js', () => ({
  MinimalDapClient: MockMinimalDapClient
}));

describe('ChildSessionManager', () => {
  let manager: ChildSessionManager;

  beforeEach(() => {
    MockMinimalDapClient.lastInstance = null;
    MockMinimalDapClient.instances = [];
    MockMinimalDapClient.hangCommands.clear();
    MockMinimalDapClient.failCommands.clear();
    MockMinimalDapClient.suppressInitialized = false;
    MockMinimalDapClient.setBreakpointsResponse = undefined;
    MockMinimalDapClient.setBreakpointsResponses = [];
    MockMinimalDapClient.emitStoppedAfterAttach = false;
    MockMinimalDapClient.emitInitializedAfterAttach = false;
    MockMinimalDapClient.emitInitializedSyncOn.clear();
    MockMinimalDapClient.threadsResponse = undefined;
    MockMinimalDapClient.shutdownThrows = false;
  });

  describe('JavaScript policy (multi-session)', () => {
    beforeEach(() => {
      manager = new ChildSessionManager({
        policy: JsDebugAdapterPolicy,
        host: 'localhost',
        port: 9229
      });
    });
    
    it('should create child session with JavaScript policy', async () => {
      // createChildSession internally waits for a 'stopped' event (15s) and a
      // post-attach 'initialized' event (3s) that the mock never emits, so it
      // burns ~18s of REAL time. Drive those timeouts with fake timers instead:
      // start it, advance fake time past the waits, then await the result.
      vi.useFakeTimers();
      try {
        const childCreatedSpy = vi.fn();
        manager.on('childCreated', childCreatedSpy);

        const config = {
          pendingId: 'test-pending-1',
          host: 'localhost',
          port: 9229,
          parentConfig: {
            type: 'pwa-node',
            request: 'launch'
          }
        };

        const createPromise = manager.createChildSession(config);
        await vi.advanceTimersByTimeAsync(20000);
        await createPromise;

        expect(childCreatedSpy).toHaveBeenCalledWith('test-pending-1', expect.any(Object));
        expect(manager.getActiveChild()).toBeDefined();
        expect(manager.hasActiveChildren()).toBe(true);

        // Default (no breakOnExceptions): child config sends empty filters,
        // preserving pre-#220 behavior byte for byte
        const child = childCreatedSpy.mock.calls[0][1] as MockMinimalDapClient;
        const exceptionRequests = child.requests.filter(r => r.command === 'setExceptionBreakpoints');
        expect(exceptionRequests.length).toBeGreaterThan(0);
        expect(exceptionRequests[0].args).toEqual({ filters: [] });
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not stall adoption when the post-attach initialized rides the attach response (issue #529)', async () => {
      // The post-attach 'initialized' is emitted synchronously during the
      // attach request — before handlePostAttachInit could register a
      // listener. Without the latch, its 3s waitForEvent times out in full,
      // delaying the CDP bridge attach past the entry pause.
      vi.useFakeTimers();
      try {
        MockMinimalDapClient.emitInitializedSyncOn.add('attach');
        MockMinimalDapClient.emitStoppedAfterAttach = true;

        const createPromise = manager.createChildSession({
          pendingId: 'test-pending-race',
          host: 'localhost',
          port: 9229,
          parentConfig: { type: 'pwa-node', request: 'launch' }
        });
        let resolved = false;
        void createPromise.then(() => { resolved = true; }, () => { resolved = true; });

        // Well under the 3s post-attach wait: adoption must already be done.
        await vi.advanceTimersByTimeAsync(1000);
        expect(resolved).toBe(true);
        await createPromise;

        // sawPostInit=true also gates the post-attach mirror re-send: a
        // second setExceptionBreakpoints proves the latch was consumed
        // rather than the wait timing out to false.
        const child = MockMinimalDapClient.instances[0];
        const exceptionRequests = child.requests.filter(r => r.command === 'setExceptionBreakpoints');
        expect(exceptionRequests.length).toBeGreaterThanOrEqual(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not stall adoption when initialized rides the initialize response (issue #529)', async () => {
      vi.useFakeTimers();
      try {
        MockMinimalDapClient.suppressInitialized = true;
        MockMinimalDapClient.emitInitializedSyncOn.add('initialize');
        MockMinimalDapClient.emitStoppedAfterAttach = true;

        const createPromise = manager.createChildSession({
          pendingId: 'test-pending-race-init',
          host: 'localhost',
          port: 9229,
          parentConfig: { type: 'pwa-node', request: 'launch' }
        });
        let resolved = false;
        void createPromise.then(() => { resolved = true; }, () => { resolved = true; });

        // Well under initializeChild's 12s wait (and the 3s post-attach one).
        // The post-attach wait sees no second 'initialized' and legitimately
        // times out at 3s — advance past it, but nowhere near 12s.
        await vi.advanceTimersByTimeAsync(4000);
        expect(resolved).toBe(true);
        await createPromise;
        expect(manager.hasActiveChildren()).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('sends resolved exception filters to the child when a break mode is set (issue #220)', async () => {
      vi.useFakeTimers();
      try {
        manager.setExceptionBreakMode('uncaught');

        const childCreatedSpy = vi.fn();
        manager.on('childCreated', childCreatedSpy);

        const createPromise = manager.createChildSession({
          pendingId: 'test-pending-ex',
          host: 'localhost',
          port: 9229,
          parentConfig: {
            type: 'pwa-node',
            request: 'launch'
          }
        });
        await vi.advanceTimersByTimeAsync(20000);
        await createPromise;

        const child = childCreatedSpy.mock.calls[0][1] as MockMinimalDapClient;
        const exceptionRequests = child.requests.filter(r => r.command === 'setExceptionBreakpoints');
        expect(exceptionRequests.length).toBeGreaterThan(0);
        for (const req of exceptionRequests) {
          expect(req.args).toEqual({ filters: ['uncaught'] });
        }
      } finally {
        vi.useRealTimers();
      }
    });
    
    it('flushEvents resolves only after chained child events have been forwarded (issue #366)', async () => {
      vi.useFakeTimers();
      try {
        const childCreatedSpy = vi.fn();
        manager.on('childCreated', childCreatedSpy);
        const createPromise = manager.createChildSession({
          pendingId: 'test-pending-flush',
          host: 'localhost',
          port: 9229,
          parentConfig: { type: 'pwa-node', request: 'launch' }
        });
        await vi.advanceTimersByTimeAsync(20000);
        await createPromise;

        const child = childCreatedSpy.mock.calls[0][1] as MockMinimalDapClient;
        const forwarded: string[] = [];
        manager.on('childEvent', (evt: { event: string }) => forwarded.push(evt.event));

        // js-debug policy => CDP bridge active => output events ride the
        // serialization chain (microtask-deferred).
        child.emit('event', { seq: 1, type: 'event', event: 'output', body: { category: 'stdout', output: 'LOGPOINT a=1\n' } });
        child.emit('event', { seq: 2, type: 'event', event: 'output', body: { category: 'stdout', output: 'done\n' } });

        await manager.flushEvents();
        expect(forwarded).toEqual(['output', 'output']);
      } finally {
        vi.useRealTimers();
      }
    });

    it('skips the entry-stop pause for attach-mode parents (issue #124)', async () => {
      // MinimalDapClient.enrichChildConfig threads request:'attach' into the
      // parentConfig of attach-mode children. For those, ensureChildStopped
      // must be skipped entirely: attach targets emit no entry stop (waiting
      // stalls adoption for 15s) and the SessionManager owns the post-attach
      // pause via getAttachBehavior().pauseAfterAttach.
      vi.useFakeTimers();
      try {
        const config = {
          pendingId: 'test-pending-attach',
          host: 'localhost',
          port: 9229,
          parentConfig: {
            type: 'pwa-node',
            request: 'attach'
          }
        };

        const createPromise = manager.createChildSession(config);
        // Only the post-attach initialized wait (3s) should be pending — the
        // 15s ensureChildStopped stall must not run for attach parents.
        await vi.advanceTimersByTimeAsync(4000);
        await createPromise;

        const child = manager.getActiveChild() as unknown as MockMinimalDapClient;
        expect(child).toBeDefined();
        const commands = child.requests.map(r => r.command);
        expect(commands).not.toContain('pause');
        expect(manager.hasActiveChildren()).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should route commands to child when policy specifies', () => {
      // JavaScript policy routes many commands to child
      expect(manager.shouldRouteToChild('threads')).toBe(true);
      expect(manager.shouldRouteToChild('pause')).toBe(true);
      expect(manager.shouldRouteToChild('continue')).toBe(true);
      expect(manager.shouldRouteToChild('stackTrace')).toBe(true);
      expect(manager.shouldRouteToChild('exceptionInfo')).toBe(true);
      
      // But not all commands
      expect(manager.shouldRouteToChild('initialize')).toBe(false);
      expect(manager.shouldRouteToChild('launch')).toBe(false);
    });
    
    it('should mirror breakpoints when policy requires', () => {
      vi.spyOn(manager as any, 'storedBreakpoints', 'get')
        .mockReturnValue(new Map());
      
      const breakpoints: DebugProtocol.SourceBreakpoint[] = [
        { line: 10 },
        { line: 20, condition: 'x > 5' }
      ];
      
      manager.storeBreakpoints('/path/to/file.js', breakpoints);
      
      // Check that breakpoints are stored
      expect((manager as any).storedBreakpoints.size).toBeGreaterThan(0);
    });

    it('mirrors stored breakpoints to the active child session', async () => {
      vi.useFakeTimers();
      try {
        const createPromise = manager.createChildSession({
          pendingId: 'child-breakpoints',
          host: 'localhost',
          port: 9229,
          parentConfig: {}
        });
        await vi.advanceTimersByTimeAsync(20000);
        await createPromise;

        const child = manager.getActiveChild() as unknown as MockMinimalDapClient;
        child.requests = [];

        manager.storeBreakpoints('/absolute/path/to/file.js', [{ line: 42 }]);

        expect(child.requests.some(req => req.command === 'setBreakpoints')).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('synthesizes breakpoint events from mid-session mirror responses (issue: verified never reaches store)', async () => {
      vi.useFakeTimers();
      try {
        const createPromise = manager.createChildSession({
          pendingId: 'child-bp-events',
          host: 'localhost',
          port: 9229,
          parentConfig: {}
        });
        await vi.advanceTimersByTimeAsync(20000);
        await createPromise;

        const events: DebugProtocol.Event[] = [];
        manager.on('childEvent', (evt: DebugProtocol.Event) => {
          if (evt.event === 'breakpoint') events.push(evt);
        });

        manager.storeBreakpoints('/absolute/path/to/file.js', [{ line: 9 }, { line: 15 }]);
        // The mirror send is fire-and-forget; flush its promise chain
        await vi.advanceTimersByTimeAsync(0);

        expect(events).toHaveLength(2);
        const bodies = events.map(e => (e as DebugProtocol.BreakpointEvent).body);
        expect(bodies[0].reason).toBe('changed');
        expect(bodies[0].breakpoint).toMatchObject({
          id: 100,
          verified: true,
          line: 9,
          source: { path: '/absolute/path/to/file.js' }
        });
        expect(bodies[1].breakpoint).toMatchObject({ id: 101, verified: true, line: 15 });
      } finally {
        vi.useRealTimers();
      }
    });

    it('synthesizes breakpoint events when pre-stored breakpoints are mirrored during child creation', async () => {
      vi.useFakeTimers();
      try {
        manager.storeBreakpoints('/absolute/path/to/file.js', [{ line: 7 }]);

        const events: DebugProtocol.Event[] = [];
        manager.on('childEvent', (evt: DebugProtocol.Event) => {
          if (evt.event === 'breakpoint') events.push(evt);
        });

        const createPromise = manager.createChildSession({
          pendingId: 'child-bp-configure',
          host: 'localhost',
          port: 9229,
          parentConfig: {}
        });
        await vi.advanceTimersByTimeAsync(20000);
        await createPromise;

        expect(events.length).toBeGreaterThan(0);
        const body = (events[0] as DebugProtocol.BreakpointEvent).body;
        expect(body.reason).toBe('changed');
        expect(body.breakpoint).toMatchObject({
          verified: true,
          line: 7,
          source: { path: '/absolute/path/to/file.js' }
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('emits no breakpoint events when the mirror response has no breakpoints body', async () => {
      vi.useFakeTimers();
      try {
        MockMinimalDapClient.setBreakpointsResponse = {};

        const createPromise = manager.createChildSession({
          pendingId: 'child-bp-empty',
          host: 'localhost',
          port: 9229,
          parentConfig: {}
        });
        await vi.advanceTimersByTimeAsync(20000);
        await createPromise;

        const events: DebugProtocol.Event[] = [];
        manager.on('childEvent', (evt: DebugProtocol.Event) => {
          if (evt.event === 'breakpoint') events.push(evt);
        });

        manager.storeBreakpoints('/absolute/path/to/file.js', [{ line: 3 }]);
        await vi.advanceTimersByTimeAsync(0);

        expect(events).toHaveLength(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('resolves storeBreakpoints with the child response, and null when no child / mirror fails (issue #500)', async () => {
      // No child yet: stored for replay, resolves null
      await expect(manager.storeBreakpoints('/abs/app.js', [{ line: 1 }])).resolves.toBeNull();

      vi.useFakeTimers();
      try {
        const createPromise = manager.createChildSession({
          pendingId: 'child-bp-return',
          host: 'localhost',
          port: 9229,
          parentConfig: {}
        });
        await vi.advanceTimersByTimeAsync(20000);
        await createPromise;

        // Active child: resolves with the child's setBreakpoints response
        const respPromise = manager.storeBreakpoints('/abs/app.js', [{ line: 42 }]);
        await vi.advanceTimersByTimeAsync(0);
        const resp = await respPromise;
        expect(resp?.body?.breakpoints).toEqual([
          expect.objectContaining({ id: 100, verified: true, line: 42 })
        ]);

        // Mirror failure: resolves null, never rejects
        MockMinimalDapClient.failCommands.set('setBreakpoints', new Error('child died'));
        const failPromise = manager.storeBreakpoints('/abs/app.js', [{ line: 42 }]);
        await vi.advanceTimersByTimeAsync(0);
        await expect(failPromise).resolves.toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('mirrors and synthesizes verified events for attach-mode parents (issue #500)', async () => {
      vi.useFakeTimers();
      try {
        const createPromise = manager.createChildSession({
          pendingId: 'child-bp-attach',
          host: 'localhost',
          port: 9229,
          parentConfig: { type: 'pwa-node', request: 'attach' }
        });
        await vi.advanceTimersByTimeAsync(4000);
        await createPromise;

        const events: DebugProtocol.Event[] = [];
        manager.on('childEvent', (evt: DebugProtocol.Event) => {
          if (evt.event === 'breakpoint') events.push(evt);
        });

        const respPromise = manager.storeBreakpoints('/abs/attach_target.js', [{ line: 11 }]);
        await vi.advanceTimersByTimeAsync(0);
        const resp = await respPromise;

        expect(resp?.body?.breakpoints?.[0]).toMatchObject({ id: 100, verified: true, line: 11 });
        expect(events).toHaveLength(1);
        expect((events[0] as DebugProtocol.BreakpointEvent).body.breakpoint).toMatchObject({
          verified: true,
          line: 11
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('clears and re-sets on a short no-change echo when forceFreshEcho is set (issue #500)', async () => {
      vi.useFakeTimers();
      try {
        const createPromise = manager.createChildSession({
          pendingId: 'child-bp-fresh-echo',
          host: 'localhost',
          port: 9229,
          parentConfig: { type: 'pwa-node', request: 'attach' }
        });
        await vi.advanceTimersByTimeAsync(4000);
        await createPromise;
        const child = manager.getActiveChild() as unknown as MockMinimalDapClient;
        child.requests = [];

        // js-debug answers a no-change re-send with an EMPTY breakpoints
        // array; the clear+reset must then produce a real echo.
        MockMinimalDapClient.setBreakpointsResponses = [
          { body: { breakpoints: [] } } // initial send: short echo
          // clear + re-set fall through to the default (verified) response
        ];

        const respPromise = manager.storeBreakpoints('/abs/attach_target.js', [{ line: 11 }], {
          forceFreshEcho: true
        });
        await vi.advanceTimersByTimeAsync(0);
        const resp = await respPromise;

        const sbCalls = child.requests.filter(r => r.command === 'setBreakpoints');
        expect(sbCalls).toHaveLength(3);
        expect((sbCalls[0].args as { breakpoints: unknown[] }).breakpoints).toHaveLength(1);
        expect((sbCalls[1].args as { breakpoints: unknown[] }).breakpoints).toHaveLength(0);
        expect((sbCalls[2].args as { breakpoints: unknown[] }).breakpoints).toHaveLength(1);
        expect(resp?.body?.breakpoints?.[0]).toMatchObject({ id: 100, verified: true, line: 11 });
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not clear+reset on a short echo without forceFreshEcho, or on a complete echo with it', async () => {
      vi.useFakeTimers();
      try {
        const createPromise = manager.createChildSession({
          pendingId: 'child-bp-no-fresh-echo',
          host: 'localhost',
          port: 9229,
          parentConfig: {}
        });
        await vi.advanceTimersByTimeAsync(20000);
        await createPromise;
        const child = manager.getActiveChild() as unknown as MockMinimalDapClient;

        // Short echo, no flag: returned as-is, single send
        child.requests = [];
        MockMinimalDapClient.setBreakpointsResponses = [{ body: { breakpoints: [] } }];
        const shortPromise = manager.storeBreakpoints('/abs/app.js', [{ line: 5 }]);
        await vi.advanceTimersByTimeAsync(0);
        const shortResp = await shortPromise;
        expect(child.requests.filter(r => r.command === 'setBreakpoints')).toHaveLength(1);
        expect(shortResp?.body?.breakpoints).toHaveLength(0);

        // Complete echo, flag set: no clear+reset round-trip
        child.requests = [];
        const fullPromise = manager.storeBreakpoints('/abs/app.js', [{ line: 5 }], {
          forceFreshEcho: true
        });
        await vi.advanceTimersByTimeAsync(0);
        await fullPromise;
        expect(child.requests.filter(r => r.command === 'setBreakpoints')).toHaveLength(1);
      } finally {
        vi.useRealTimers();
      }
    });

    
    it('releases a target that arrives while adoption is in progress (issue #501)', async () => {
      const config1 = {
        pendingId: 'pending-1',
        host: 'localhost',
        port: 9229,
        parentConfig: {}
      };

      const config2 = {
        pendingId: 'pending-2',
        host: 'localhost',
        port: 9229,
        parentConfig: {}
      };

      vi.useFakeTimers();
      try {
        // Start first adoption
        const promise1 = manager.createChildSession(config1);

        // Try to start second while first is in progress
        const promise2 = manager.createChildSession(config2);

        await vi.advanceTimersByTimeAsync(20000);
        const [outcome1, outcome2] = await Promise.all([promise1, promise2]);

        // First is adopted; second cannot be, but instead of being silently
        // dropped (leaving the forked process parked in waitForDebugger) it
        // is attached-and-detached so it runs undebugged
        expect(outcome1).toBe('adopted');
        expect(outcome2).toBe('released');
        expect(manager.getActiveChild()).toBeDefined();
        expect(manager.hasActiveChildren()).toBe(true);

        // The release rode a separate throwaway client with the minimal
        // unpark sequence, then closed its socket
        const releaseClient = MockMinimalDapClient.instances.find(c =>
          c.requests.some(r =>
            r.command === 'attach' &&
            (r.args as Record<string, unknown>).__pendingTargetId === 'pending-2'
          )
        );
        expect(releaseClient).toBeDefined();
        const commands = releaseClient!.requests.map(r => r.command);
        expect(commands).toEqual(['initialize', 'configurationDone', 'attach', 'disconnect']);
        const attachArgs = releaseClient!.requests[2].args as Record<string, unknown>;
        expect(attachArgs.continueOnAttach).toBe(true);
        const disconnectArgs = releaseClient!.requests[3].args as Record<string, unknown>;
        expect(disconnectArgs.terminateDebuggee).toBe(false);
        expect(releaseClient!.shutdownCalls).toEqual(['release complete']);

        // Adoption state is untouched by the release
        expect(releaseClient).not.toBe(manager.getActiveChild());
        expect(manager.isAdopted('pending-2')).toBe(false);
        expect((manager as any).childSessions.size).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('tags adoption and release connections for the DAP trace (issue #518)', async () => {
      vi.useFakeTimers();
      try {
        const adoption = manager.createChildSession({
          pendingId: 'adopted-target-1',
          host: 'localhost',
          port: 9229,
          parentConfig: {}
        });
        await vi.advanceTimersByTimeAsync(20000);
        expect(await adoption).toBe('adopted');

        const release = manager.createChildSession({
          pendingId: 'released-target-1',
          host: 'localhost',
          port: 9229,
          parentConfig: {}
        });
        await vi.advanceTimersByTimeAsync(20000);
        expect(await release).toBe('released');

        const adopted = MockMinimalDapClient.instances.find(
          (c) => c.options?.traceLabel?.startsWith('child:')
        );
        const released = MockMinimalDapClient.instances.find(
          (c) => c.options?.traceLabel?.startsWith('release:')
        );
        expect(adopted?.options?.traceLabel).toBe('child:adopted-');
        expect(released?.options?.traceLabel).toBe('release:released');
      } finally {
        vi.useRealTimers();
      }
    });

    it('releases a target when a child is already active, exactly once (issue #501)', async () => {
      vi.useFakeTimers();
      try {
        const adoption = manager.createChildSession({
          pendingId: 'first-child',
          host: 'localhost',
          port: 9229,
          parentConfig: {}
        });
        await vi.advanceTimersByTimeAsync(20000);
        expect(await adoption).toBe('adopted');
        const activeChild = manager.getActiveChild();

        const release = manager.createChildSession({
          pendingId: 'forked-child',
          host: 'localhost',
          port: 9229,
          parentConfig: {}
        });
        await vi.advanceTimersByTimeAsync(20000);
        expect(await release).toBe('released');

        // A repeat request for the released target is a no-op duplicate
        const clientCount = MockMinimalDapClient.instances.length;
        const repeat = manager.createChildSession({
          pendingId: 'forked-child',
          host: 'localhost',
          port: 9229,
          parentConfig: {}
        });
        await vi.advanceTimersByTimeAsync(20000);
        expect(await repeat).toBe('duplicate');
        expect(MockMinimalDapClient.instances.length).toBe(clientCount);

        // Active child undisturbed throughout
        expect(manager.getActiveChild()).toBe(activeChild);
      } finally {
        vi.useRealTimers();
      }
    });

    it('reports release-failed and stays retryable when the release attach fails (issue #501)', async () => {
      vi.useFakeTimers();
      try {
        const adoption = manager.createChildSession({
          pendingId: 'first-child',
          host: 'localhost',
          port: 9229,
          parentConfig: {}
        });
        await vi.advanceTimersByTimeAsync(20000);
        expect(await adoption).toBe('adopted');
        const activeChild = manager.getActiveChild();

        MockMinimalDapClient.failCommands.set('attach', new Error('target gone'));
        const failed = manager.createChildSession({
          pendingId: 'forked-child',
          host: 'localhost',
          port: 9229,
          parentConfig: {}
        });
        await vi.advanceTimersByTimeAsync(30000);
        expect(await failed).toBe('release-failed');
        expect(manager.getActiveChild()).toBe(activeChild);

        // The failed release rolled its bookkeeping back: a re-sent
        // startDebugging retries the release and can now succeed
        MockMinimalDapClient.failCommands.clear();
        const retried = manager.createChildSession({
          pendingId: 'forked-child',
          host: 'localhost',
          port: 9229,
          parentConfig: {}
        });
        await vi.advanceTimersByTimeAsync(20000);
        expect(await retried).toBe('released');
      } finally {
        vi.useRealTimers();
      }
    });

    it('bounds a hung release and settles without touching the active child (issue #501)', async () => {
      vi.useFakeTimers();
      try {
        const adoption = manager.createChildSession({
          pendingId: 'first-child',
          host: 'localhost',
          port: 9229,
          parentConfig: {}
        });
        await vi.advanceTimersByTimeAsync(20000);
        expect(await adoption).toBe('adopted');

        MockMinimalDapClient.hangCommands.add('attach');
        const hung = manager.createChildSession({
          pendingId: 'forked-child',
          host: 'localhost',
          port: 9229,
          parentConfig: {}
        });
        // The release flow is bounded at 20s overall
        await vi.advanceTimersByTimeAsync(25000);
        expect(await hung).toBe('release-failed');
        expect(manager.getActiveChild()).toBeDefined();

        // The hung throwaway socket was still torn down
        const releaseClient = MockMinimalDapClient.instances.find(c =>
          c.requests.some(r =>
            r.command === 'attach' &&
            (r.args as Record<string, unknown>).__pendingTargetId === 'forked-child'
          )
        );
        expect(releaseClient!.shutdownCalls).toEqual(['release complete']);
      } finally {
        vi.useRealTimers();
      }
    });

    it('never mirrors breakpoints to a release client (issue #501)', async () => {
      vi.useFakeTimers();
      try {
        const adoption = manager.createChildSession({
          pendingId: 'first-child',
          host: 'localhost',
          port: 9229,
          parentConfig: {}
        });
        await vi.advanceTimersByTimeAsync(20000);
        expect(await adoption).toBe('adopted');

        const release = manager.createChildSession({
          pendingId: 'forked-child',
          host: 'localhost',
          port: 9229,
          parentConfig: {}
        });
        await vi.advanceTimersByTimeAsync(20000);
        expect(await release).toBe('released');

        const storePromise = manager.storeBreakpoints('/abs/app.js', [{ line: 5 }]);
        await vi.advanceTimersByTimeAsync(0);
        await storePromise;

        const releaseClient = MockMinimalDapClient.instances.find(c =>
          c.requests.some(r =>
            r.command === 'attach' &&
            (r.args as Record<string, unknown>).__pendingTargetId === 'forked-child'
          )
        );
        expect(releaseClient!.requests.filter(r => r.command === 'setBreakpoints')).toHaveLength(0);
        const child = manager.getActiveChild() as unknown as MockMinimalDapClient;
        expect(child.requests.filter(r => r.command === 'setBreakpoints').length).toBeGreaterThan(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('ignores duplicate adoption requests for the same pending target', async () => {
      vi.useFakeTimers();
      try {
        const first = manager.createChildSession({
          pendingId: 'dup-target',
          host: 'localhost',
          port: 9229,
          parentConfig: {}
        });
        await vi.advanceTimersByTimeAsync(20000);
        await first;

        expect(manager.isAdopted('dup-target')).toBe(true);

        const second = manager.createChildSession({
          pendingId: 'dup-target',
          host: 'localhost',
          port: 9229,
          parentConfig: {}
        });
        await vi.advanceTimersByTimeAsync(20000);
        await second;

        expect(manager.isAdopted('dup-target')).toBe(true);
        expect((manager as any).childSessions.size).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });

    
    it('should forward child events to parent', async () => {
      vi.useFakeTimers();
      try {
        const childEventSpy = vi.fn();
        manager.on('childEvent', childEventSpy);

        const createPromise = manager.createChildSession({
          pendingId: 'test-1',
          host: 'localhost',
          port: 9229,
          parentConfig: {}
        });
        await vi.advanceTimersByTimeAsync(20000);
        await createPromise;

        const child = manager.getActiveChild();
        if (child) {
          // Simulate child emitting an event. Forwarding for cdp-delivery
          // policies goes through the serialized event chain (issue #295), so
          // it lands a microtask later.
          (child as any).emit('event', { event: 'stopped', body: {} });
          await vi.advanceTimersByTimeAsync(0);

          expect(childEventSpy).toHaveBeenCalledWith({ event: 'stopped', body: {} });
        }
      } finally {
        vi.useRealTimers();
      }
    });
    
  });
  
  describe('Death-aware adoption (issue #248)', () => {
    const config = (pendingId: string) => ({
      pendingId,
      host: 'localhost',
      port: 9229,
      parentConfig: { type: 'pwa-node', request: 'launch' }
    });

    beforeEach(() => {
      manager = new ChildSessionManager({
        policy: JsDebugAdapterPolicy,
        host: 'localhost',
        port: 9229
      });
    });

    it('aborts adoption promptly when the child connection closes mid-attach', async () => {
      vi.useFakeTimers();
      try {
        MockMinimalDapClient.hangCommands.add('attach');

        const guarded = manager
          .createChildSession(config('dying-child'))
          .then(() => null, (e: Error) => e);

        // Let adoption progress into the hanging attach request
        await vi.advanceTimersByTimeAsync(100);
        const child = MockMinimalDapClient.lastInstance!;
        expect(child.requests.some(r => r.command === 'attach')).toBe(true);

        child.emit('close');
        await vi.advanceTimersByTimeAsync(0);

        // Settles now — without burning the ~400s retry window
        const err = await guarded;
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toMatch(/closed/i);
        expect(manager.hasActiveChildren()).toBe(false);
        expect(manager.isAdopted('dying-child')).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('aborts at the step boundary when the child dies while waiting for initialized', async () => {
      vi.useFakeTimers();
      try {
        // initialize responds but the initialized event never arrives; the
        // child then dies. Adoption must reject rather than march the
        // remaining steps against a dead client.
        MockMinimalDapClient.suppressInitialized = true;

        const guarded = manager
          .createChildSession(config('dead-at-init'))
          .then(() => null, (e: Error) => e);

        await vi.advanceTimersByTimeAsync(50);
        const child = MockMinimalDapClient.lastInstance!;
        expect(child.requests.some(r => r.command === 'initialize')).toBe(true);

        child.emit('close');
        await vi.advanceTimersByTimeAsync(0);

        const err = await guarded;
        expect(err).toBeInstanceOf(Error);
        expect(manager.hasActiveChildren()).toBe(false);
        expect(manager.isAdopted('dead-at-init')).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('fails attach after the total deadline instead of retrying forever', async () => {
      vi.useFakeTimers();
      try {
        MockMinimalDapClient.hangCommands.add('attach');

        const guarded = manager
          .createChildSession(config('deadline-child'))
          .then(() => null, (e: Error) => e);

        await vi.advanceTimersByTimeAsync(100);
        // No close event — the child is alive but never answers attach.
        await vi.advanceTimersByTimeAsync(61000);

        const err = await guarded;
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toMatch(/deadline|Failed to attach/i);
        expect(manager.hasActiveChildren()).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('rolls back registration and shuts down the child when adoption fails, allowing retry', async () => {
      vi.useFakeTimers();
      try {
        MockMinimalDapClient.failCommands.set('attach', new Error('ECONNREFUSED'));

        const guarded = manager
          .createChildSession(config('retry-target'))
          .then(() => null, (e: Error) => e);
        await vi.advanceTimersByTimeAsync(70000);

        const err = await guarded;
        expect(err).toBeInstanceOf(Error);

        const failedChild = MockMinimalDapClient.lastInstance!;
        expect(failedChild.shutdownCalls.length).toBeGreaterThan(0);
        expect(manager.hasActiveChildren()).toBe(false);
        expect(manager.isAdopted('retry-target')).toBe(false);

        // A retry for the same pending target must be able to succeed
        MockMinimalDapClient.failCommands.clear();
        const retry = manager.createChildSession(config('retry-target'));
        await vi.advanceTimersByTimeAsync(20000);
        await retry;

        expect(manager.hasActiveChildren()).toBe(true);
        expect(manager.isAdopted('retry-target')).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Python policy (single-session)', () => {
    beforeEach(() => {
      manager = new ChildSessionManager({
        policy: PythonAdapterPolicy,
        host: 'localhost',
        port: 5678
      });
    });
    
    it('should not route commands to children for Python', () => {
      expect(manager.shouldRouteToChild('threads')).toBe(false);
      expect(manager.shouldRouteToChild('pause')).toBe(false);
      expect(manager.shouldRouteToChild('continue')).toBe(false);
    });
    
    it('should not mirror breakpoints for Python', () => {
      const breakpoints: DebugProtocol.SourceBreakpoint[] = [
        { line: 10 }
      ];
      
      manager.storeBreakpoints('/path/to/file.py', breakpoints);

      // Python doesn't mirror breakpoints
      expect((manager as any).storedBreakpoints.size).toBe(0);
    });

    it('synthesizes no breakpoint events for non-mirroring policies', async () => {
      const events: unknown[] = [];
      manager.on('childEvent', (evt: DebugProtocol.Event) => {
        if (evt.event === 'breakpoint') events.push(evt);
      });

      manager.storeBreakpoints('/path/to/file.py', [{ line: 10 }]);
      await new Promise(resolve => setImmediate(resolve));

      expect(events).toHaveLength(0);
    });
  });
  
  describe('Default policy', () => {
    beforeEach(() => {
      manager = new ChildSessionManager({
        policy: DefaultAdapterPolicy,
        host: 'localhost',
        port: 9229
      });
    });
    
    it('should handle default policy with no child sessions', () => {
      expect(manager.hasActiveChildren()).toBe(false);
      expect(manager.getActiveChild()).toBeNull();
      expect(manager.shouldRouteToChild('any-command')).toBe(false);
    });
  });
  
  describe('Shutdown', () => {
    it('should shutdown all child sessions', async () => {
      vi.useFakeTimers();
      try {
        manager = new ChildSessionManager({
          policy: JsDebugAdapterPolicy,
          host: 'localhost',
          port: 9229
        });

        // Create multiple child sessions
        const createPromise = manager.createChildSession({
          pendingId: 'child-1',
          host: 'localhost',
          port: 9229,
          parentConfig: {}
        });
        await vi.advanceTimersByTimeAsync(20000);
        await createPromise;

        expect(manager.hasActiveChildren()).toBe(true);

        await manager.shutdown();

        expect(manager.hasActiveChildren()).toBe(false);
        expect(manager.getActiveChild()).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('CDP function breakpoints (issue #295)', () => {
    class FakeBridge extends EventEmitter {
      attachCalls: unknown[] = [];
      detachCalls = 0;
      syncCalls: DebugProtocol.FunctionBreakpoint[][] = [];
      armed = false;
      holdMs = 0;
      transform: ((evt: DebugProtocol.Event) => DebugProtocol.Event) | null = null;

      async attachToChild(child: unknown): Promise<void> {
        this.attachCalls.push(child);
      }

      detach(): void {
        this.detachCalls++;
      }

      hasArmedOrPending(): boolean {
        return this.armed;
      }

      async sync(bps: DebugProtocol.FunctionBreakpoint[]): Promise<{ breakpoints: DebugProtocol.Breakpoint[] }> {
        this.syncCalls.push(bps);
        return { breakpoints: bps.map((_, i) => ({ id: 1_000_000 + i, verified: true })) };
      }

      async processStoppedEvent(evt: DebugProtocol.Event): Promise<DebugProtocol.Event> {
        if (this.holdMs) {
          await new Promise((r) => setTimeout(r, this.holdMs));
        }
        return this.transform ? this.transform(evt) : evt;
      }
    }

    let bridge: FakeBridge;
    let factoryCalls: number;

    function makeManager(policy: AdapterPolicy): ChildSessionManager {
      return new ChildSessionManager({
        policy,
        host: 'localhost',
        port: 9229,
        cdpBridgeFactory: () => {
          factoryCalls++;
          return bridge as never;
        }
      });
    }

    async function adopt(mgr: ChildSessionManager): Promise<MockMinimalDapClient> {
      vi.useFakeTimers();
      try {
        const childCreatedSpy = vi.fn();
        mgr.on('childCreated', childCreatedSpy);
        const createPromise = mgr.createChildSession({
          pendingId: 'cdp-child',
          host: 'localhost',
          port: 9229,
          parentConfig: { type: 'pwa-node', request: 'launch' }
        });
        await vi.advanceTimersByTimeAsync(20000);
        await createPromise;
        return childCreatedSpy.mock.calls[0][1] as MockMinimalDapClient;
      } finally {
        vi.useRealTimers();
      }
    }

    beforeEach(() => {
      bridge = new FakeBridge();
      factoryCalls = 0;
    });

    it('creates the bridge only for cdp-delivery policies', () => {
      makeManager(PythonAdapterPolicy);
      expect(factoryCalls).toBe(0);
      makeManager(JsDebugAdapterPolicy);
      expect(factoryCalls).toBe(1);
    });

    it('syncFunctionBreakpoints delegates to the bridge', async () => {
      const mgr = makeManager(JsDebugAdapterPolicy);
      const body = await mgr.syncFunctionBreakpoints([{ name: 'greet' }]);
      expect(bridge.syncCalls).toEqual([[{ name: 'greet' }]]);
      expect(body.breakpoints[0]).toMatchObject({ id: 1_000_000, verified: true });
    });

    it('syncFunctionBreakpoints without a bridge returns an all-pending body', async () => {
      const mgr = makeManager(PythonAdapterPolicy);
      const body = await mgr.syncFunctionBreakpoints([{ name: 'a' }, { name: 'b' }]);
      expect(body.breakpoints).toHaveLength(2);
      expect(body.breakpoints.every((bp) => bp.verified === false)).toBe(true);
    });

    it('attaches the bridge to the child during adoption', async () => {
      const mgr = makeManager(JsDebugAdapterPolicy);
      const child = await adopt(mgr);
      expect(bridge.attachCalls).toEqual([child]);
    });

    it('skips the entry-stop wait when the child already reported a stop during adoption (issue #295)', async () => {
      MockMinimalDapClient.emitStoppedAfterAttach = true;
      const mgr = makeManager(JsDebugAdapterPolicy);
      vi.useFakeTimers();
      try {
        const createPromise = mgr.createChildSession({
          pendingId: 'cdp-early-stop',
          host: 'localhost',
          port: 9229,
          parentConfig: { type: 'pwa-node', request: 'launch', stopOnEntry: true }
        });
        await vi.advanceTimersByTimeAsync(40000);
        await createPromise;
      } finally {
        vi.useRealTimers();
      }
      // The stop arrived while earlier adoption steps ran; ensureChildStopped
      // must not fall back to the threads + pause path against a paused target
      const child = MockMinimalDapClient.lastInstance!;
      expect(child.requests.map((r) => r.command)).not.toContain('pause');
    });

    it('keeps skipping the entry pause with stopOnEntry false when no function breakpoints are pending', async () => {
      bridge.armed = false;
      const mgr = makeManager(JsDebugAdapterPolicy);
      vi.useFakeTimers();
      try {
        const createPromise = mgr.createChildSession({
          pendingId: 'cdp-no-entry-pause',
          host: 'localhost',
          port: 9229,
          parentConfig: { type: 'pwa-node', request: 'launch', stopOnEntry: false }
        });
        await vi.advanceTimersByTimeAsync(40000);
        await createPromise;
      } finally {
        vi.useRealTimers();
      }
      const child = MockMinimalDapClient.lastInstance!;
      expect(child.requests.map((r) => r.command)).not.toContain('pause');
    });

    it('routes stopped events through the bridge and preserves order around a held stop', async () => {
      const mgr = makeManager(JsDebugAdapterPolicy);
      const child = await adopt(mgr);

      bridge.armed = true;
      bridge.holdMs = 25;
      bridge.transform = (evt) => ({
        ...evt,
        body: { ...(evt.body as object), reason: 'function breakpoint' }
      });

      const forwarded: DebugProtocol.Event[] = [];
      mgr.on('childEvent', (evt: DebugProtocol.Event) => forwarded.push(evt));

      (child as unknown as EventEmitter).emit('event', { event: 'stopped', body: { reason: 'breakpoint' } });
      (child as unknown as EventEmitter).emit('event', { event: 'output', body: { output: 'later' } });

      await new Promise((r) => setTimeout(r, 80));
      expect(forwarded.map((e) => e.event)).toEqual(['stopped', 'output']);
      expect((forwarded[0].body as { reason: string }).reason).toBe('function breakpoint');
    });

    it('forwards non-stopped events without consulting the bridge when nothing is armed', async () => {
      const mgr = makeManager(JsDebugAdapterPolicy);
      const child = await adopt(mgr);
      bridge.armed = false;
      bridge.transform = () => {
        throw new Error('must not be called');
      };
      const forwarded: DebugProtocol.Event[] = [];
      mgr.on('childEvent', (evt: DebugProtocol.Event) => forwarded.push(evt));
      (child as unknown as EventEmitter).emit('event', { event: 'stopped', body: { reason: 'step' } });
      await new Promise((r) => setTimeout(r, 10));
      expect(forwarded).toHaveLength(1);
      expect((forwarded[0].body as { reason: string }).reason).toBe('step');
    });

    it('re-emits bridge breakpointEvents as childEvents', async () => {
      const mgr = makeManager(JsDebugAdapterPolicy);
      const forwarded: DebugProtocol.Event[] = [];
      mgr.on('childEvent', (evt: DebugProtocol.Event) => forwarded.push(evt));
      const bpEvent = { seq: 0, type: 'event', event: 'breakpoint', body: { reason: 'changed', breakpoint: { id: 1_000_001, verified: true } } };
      bridge.emit('breakpointEvent', bpEvent);
      expect(forwarded).toEqual([bpEvent]);
    });

    it('detaches the bridge on child close and on shutdown', async () => {
      const mgr = makeManager(JsDebugAdapterPolicy);
      const child = await adopt(mgr);
      (child as unknown as EventEmitter).emit('close');
      expect(bridge.detachCalls).toBe(1);
      await mgr.shutdown();
      expect(bridge.detachCalls).toBe(2);
    });
  });

  describe('adoption edges and the child-safe policy (coverage sprint)', () => {
    const childConfig = {
      pendingId: 'edge-pending-1',
      host: 'localhost',
      port: 9229,
      parentConfig: { type: 'pwa-node', request: 'launch' }
    };

    async function createChild(mgr: ChildSessionManager): Promise<void> {
      vi.useFakeTimers();
      try {
        const promise = mgr.createChildSession(childConfig);
        await vi.advanceTimersByTimeAsync(20000);
        await promise;
      } finally {
        vi.useRealTimers();
      }
    }

    it('hands children a policy that cannot spawn grandchildren', async () => {
      const baseHandle = vi.fn(async (req: DebugProtocol.Request) =>
        req.command === 'startDebugging' ? { handled: true, wouldSpawn: true } : { handled: false }
      );
      const basePolicy: AdapterPolicy = {
        ...JsDebugAdapterPolicy,
        getDapClientBehavior: () => ({
          ...JsDebugAdapterPolicy.getDapClientBehavior(),
          handleReverseRequest: baseHandle as never
        })
      };
      const mgr = new ChildSessionManager({ policy: basePolicy, host: 'localhost', port: 9229 });
      await createChild(mgr);

      const childPolicy = MockMinimalDapClient.lastInstance!.policy!;
      expect(childPolicy.supportsReverseStartDebugging).toBe(false);
      expect(childPolicy.childSessionStrategy).toBe('none');

      const behavior = childPolicy.getDapClientBehavior();
      expect(behavior.mirrorBreakpointsToChild).toBe(false);
      expect(behavior.pauseAfterChildAttach).toBe(false);
      expect(behavior.childRoutedCommands?.size).toBe(0);

      // A grandchild-spawning reverse request is acknowledged and stopped
      const spawnResult = await behavior.handleReverseRequest!(
        { seq: 1, type: 'request', command: 'startDebugging' } as never,
        {} as never
      );
      expect(spawnResult).toEqual({ handled: true });

      // Unhandled reverse requests pass through untouched
      const passthrough = await behavior.handleReverseRequest!(
        { seq: 2, type: 'request', command: 'somethingElse' } as never,
        {} as never
      );
      expect(passthrough).toEqual({ handled: false });

      await mgr.shutdown();
    });

    it('releases a fork startDebugging arriving on the child connection (issue #501)', async () => {
      const mgr = new ChildSessionManager({ policy: JsDebugAdapterPolicy, host: 'localhost', port: 9229 });
      await createChild(mgr);

      // js-debug delivers fork auto-attach startDebugging requests on the
      // ADOPTED CHILD's connection, so the child-safe policy must hand them
      // back to the manager for release instead of dropping them
      const childPolicy = MockMinimalDapClient.lastInstance!.policy!;
      const behavior = childPolicy.getDapClientBehavior();

      vi.useFakeTimers();
      try {
        const result = await behavior.handleReverseRequest!(
          {
            seq: 3,
            type: 'request',
            command: 'startDebugging',
            arguments: { configuration: { __pendingTargetId: 'grandchild-1' } }
          } as never,
          { sendResponse: vi.fn(), adoptedTargets: new Set(), activeChildren: new Map() } as never
        );
        expect(result).toEqual({ handled: true });
        // The forward is fire-and-forget; drive the release flow to completion
        await vi.advanceTimersByTimeAsync(25000);
      } finally {
        vi.useRealTimers();
      }

      const releaseClient = MockMinimalDapClient.instances.find(c =>
        c.requests.some(r =>
          r.command === 'attach' &&
          (r.args as Record<string, unknown>).__pendingTargetId === 'grandchild-1'
        )
      );
      expect(releaseClient, 'the forwarded fork target must be released via a throwaway client').toBeDefined();
      expect(releaseClient!.shutdownCalls).toEqual(['release complete']);

      await mgr.shutdown();
    });

    it('survives failing configuration requests during adoption', async () => {
      MockMinimalDapClient.failCommands.set('setExceptionBreakpoints', new Error('no exception filters'));
      MockMinimalDapClient.failCommands.set('configurationDone', new Error('not required'));
      MockMinimalDapClient.failCommands.set('setBreakpoints', new Error('bp mirror failed'));

      const mgr = new ChildSessionManager({ policy: JsDebugAdapterPolicy, host: 'localhost', port: 9229 });
      mgr.storeBreakpoints('/abs/app.js', [{ line: 3 }]);
      const created = vi.fn();
      mgr.on('childCreated', created);

      await createChild(mgr);

      expect(created).toHaveBeenCalled();
      await mgr.shutdown();
    });

    it('replays stored breakpoints after a post-attach initialized event', async () => {
      MockMinimalDapClient.emitInitializedAfterAttach = true;
      const mgr = new ChildSessionManager({ policy: JsDebugAdapterPolicy, host: 'localhost', port: 9229 });
      mgr.storeBreakpoints('/abs/app.js', [{ line: 7 }]);

      await createChild(mgr);

      const child = MockMinimalDapClient.lastInstance!;
      const bpRequests = child.requests.filter(
        (r) => r.command === 'setBreakpoints' &&
          (r.args as { source?: { path?: string } })?.source?.path === '/abs/app.js'
      );
      // Once from configureChild's mirror, once from the post-attach replay
      expect(bpRequests.length).toBeGreaterThanOrEqual(2);
      await mgr.shutdown();
    });

    it('applies the js-debug double-pause quirk when the first thread id is 0', async () => {
      MockMinimalDapClient.threadsResponse = { body: { threads: [{ id: 0, name: 'main' }] } };
      const mgr = new ChildSessionManager({ policy: JsDebugAdapterPolicy, host: 'localhost', port: 9229 });

      await createChild(mgr);

      const pauses = MockMinimalDapClient.lastInstance!.requests
        .filter((r) => r.command === 'pause')
        .map((r) => (r.args as { threadId?: number })?.threadId);
      expect(pauses).toEqual(expect.arrayContaining([0, 1]));
      await mgr.shutdown();
    });

    it('tolerates a threads request failure while trying to pause the child', async () => {
      MockMinimalDapClient.failCommands.set('threads', new Error('threads unavailable'));
      const mgr = new ChildSessionManager({ policy: JsDebugAdapterPolicy, host: 'localhost', port: 9229 });
      const created = vi.fn();
      mgr.on('childCreated', created);

      await createChild(mgr);

      expect(created).toHaveBeenCalled();
      await mgr.shutdown();
    });

    it('rejects adoption once the child errors, ignoring the follow-up close', async () => {
      vi.useFakeTimers();
      try {
        MockMinimalDapClient.hangCommands.add('attach');
        const mgr = new ChildSessionManager({ policy: JsDebugAdapterPolicy, host: 'localhost', port: 9229 });
        const promise = mgr.createChildSession(childConfig);
        promise.catch(() => {});
        await vi.advanceTimersByTimeAsync(50);

        const child = MockMinimalDapClient.lastInstance!;
        child.emit('error', new Error('socket reset'));
        child.emit('close'); // second death signal must be a no-op

        await expect(promise).rejects.toThrow(/errored during adoption: socket reset/);
        await mgr.shutdown();
      } finally {
        vi.useRealTimers();
      }
    });

    it('shutdown survives a child whose own shutdown throws', async () => {
      const mgr = new ChildSessionManager({ policy: JsDebugAdapterPolicy, host: 'localhost', port: 9229 });
      await createChild(mgr);
      MockMinimalDapClient.shutdownThrows = true;

      await expect(mgr.shutdown()).resolves.toBeUndefined();
      expect((mgr as unknown as { childSessions: Map<string, unknown> }).childSessions.size).toBe(0);
    });
  });

  describe('stored breakpoint lifecycle (issue #405)', () => {
    beforeEach(() => {
      manager = new ChildSessionManager({
        policy: JsDebugAdapterPolicy,
        host: 'localhost',
        port: 9229
      });
    });

    it('clears stored breakpoints on shutdown', async () => {
      manager.storeBreakpoints('/abs/app.js', [{ line: 1 }]);
      manager.storeBreakpoints('/abs/lib.js', [{ line: 2 }]);
      expect((manager as any).storedBreakpoints.size).toBe(2);

      await manager.shutdown();

      expect((manager as any).storedBreakpoints.size).toBe(0);
    });

    it('deletes the entry when a file clears to zero breakpoints', () => {
      manager.storeBreakpoints('/abs/app.js', [{ line: 1 }]);
      expect((manager as any).storedBreakpoints.size).toBe(1);

      manager.storeBreakpoints('/abs/app.js', []);

      expect((manager as any).storedBreakpoints.size).toBe(0);
    });
  });

  describe('getChildTargetState (issue #513)', () => {
    const config = (pendingId: string) => ({
      pendingId,
      host: 'localhost',
      port: 9229,
      parentConfig: { type: 'pwa-node', request: 'launch' }
    });

    beforeEach(() => {
      manager = new ChildSessionManager({
        policy: JsDebugAdapterPolicy,
        host: 'localhost',
        port: 9229
      });
    });

    it('walks none → adopting → active → ended, and adopting again on re-adoption', async () => {
      expect(manager.getChildTargetState()).toBe('none');

      vi.useFakeTimers();
      try {
        const adoption = manager.createChildSession(config('state-child-1'));
        // adoptionInProgress is stamped synchronously, before the client
        // connects and becomes the active child
        expect(manager.getChildTargetState()).toBe('adopting');

        await vi.advanceTimersByTimeAsync(20000);
        await adoption;
        expect(manager.getChildTargetState()).toBe('active');

        const child = MockMinimalDapClient.lastInstance!;
        child.emit('close');
        await vi.advanceTimersByTimeAsync(0);
        // An adopted child that closed with nothing replacing it: routed
        // commands can only hit the parent from here on
        expect(manager.getChildTargetState()).toBe('ended');

        const readoption = manager.createChildSession(config('state-child-2'));
        expect(manager.getChildTargetState()).toBe('adopting');
        await vi.advanceTimersByTimeAsync(20000);
        await readoption;
        expect(manager.getChildTargetState()).toBe('active');
      } finally {
        vi.useRealTimers();
      }
    });

    it('reports none after shutdown', async () => {
      vi.useFakeTimers();
      try {
        const adoption = manager.createChildSession(config('state-child-3'));
        await vi.advanceTimersByTimeAsync(20000);
        await adoption;
        MockMinimalDapClient.lastInstance!.emit('close');
        await vi.advanceTimersByTimeAsync(0);
        expect(manager.getChildTargetState()).toBe('ended');
      } finally {
        vi.useRealTimers();
      }

      await manager.shutdown();
      expect(manager.getChildTargetState()).toBe('none');
    });

    it('blanks childRequiredCommands on the child-safe policy', async () => {
      vi.useFakeTimers();
      try {
        const adoption = manager.createChildSession(config('state-child-4'));
        await vi.advanceTimersByTimeAsync(20000);
        await adoption;
      } finally {
        vi.useRealTimers();
      }

      const childPolicy = MockMinimalDapClient.lastInstance!.policy!;
      const behavior = childPolicy.getDapClientBehavior();
      // Child/release connections talk to the real target directly — they
      // must never self-gate on child availability
      expect(behavior.childRequiredCommands?.size).toBe(0);
    });
  });
});

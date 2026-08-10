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
  static hangCommands = new Set<string>();
  static failCommands = new Map<string, Error>();
  static suppressInitialized = false;
  // When set, returned verbatim for setBreakpoints; otherwise a verified
  // breakpoint per requested line with child-space ids (100, 101, ...)
  static setBreakpointsResponse: unknown | undefined = undefined;
  // Emit a stopped event shortly after the attach request (issue #295 —
  // simulates the entry stop firing while later adoption steps still run)
  static emitStoppedAfterAttach = false;

  host: string;
  port: number;
  policy?: AdapterPolicy;
  connected = false;
  requests: Array<{ command: string; args: unknown }> = [];
  shutdownCalls: string[] = [];

  constructor(host: string, port: number, policy?: AdapterPolicy) {
    super();
    this.host = host;
    this.port = port;
    this.policy = policy;
    MockMinimalDapClient.lastInstance = this;
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

    // Simulate responses
    if (command === 'initialize') {
      if (!MockMinimalDapClient.suppressInitialized) {
        setTimeout(() => this.emit('event', { event: 'initialized' }), 10);
      }
      return { body: { capabilities: {} } };
    }
    if (command === 'threads') {
      return { body: { threads: [{ id: 1, name: 'main' }] } };
    }
    if (command === 'setBreakpoints') {
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
    MockMinimalDapClient.hangCommands.clear();
    MockMinimalDapClient.failCommands.clear();
    MockMinimalDapClient.suppressInitialized = false;
    MockMinimalDapClient.setBreakpointsResponse = undefined;
    MockMinimalDapClient.emitStoppedAfterAttach = false;
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

    
    it('should handle adoption in progress correctly', async () => {
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
        await Promise.all([promise1, promise2]);

        // Only one should succeed
        expect(manager.getActiveChild()).toBeDefined();
        expect(manager.hasActiveChildren()).toBe(true);
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
});

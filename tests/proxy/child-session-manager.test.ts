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
  host: string;
  port: number;
  policy?: AdapterPolicy;
  connected = false;
  requests: Array<{ command: string; args: unknown }> = [];
  
  constructor(host: string, port: number, policy?: AdapterPolicy) {
    super();
    this.host = host;
    this.port = port;
    this.policy = policy;
  }
  
  async connect(): Promise<void> {
    this.connected = true;
  }
  
  async sendRequest(command: string, args?: unknown, _timeoutMs?: number): Promise<any> {
    this.requests.push({ command, args });
    
    // Simulate responses
    if (command === 'initialize') {
      setTimeout(() => this.emit('event', { event: 'initialized' }), 10);
      return { body: { capabilities: {} } };
    }
    if (command === 'threads') {
      return { body: { threads: [{ id: 1, name: 'main' }] } };
    }
    return {};
  }
  
  shutdown(_reason: string): void {
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
          // Simulate child emitting an event
          (child as any).emit('event', { event: 'stopped', body: {} });

          expect(childEventSpy).toHaveBeenCalledWith({ event: 'stopped', body: {} });
        }
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
});

# Event Management Pattern in MCP Debug Server

This document describes the event management patterns used throughout the MCP Debug Server, focusing on proper event handling, memory leak prevention, and cleanup strategies.

## Overview

The event management system is designed to:
- Enable loose coupling between components via events
- Prevent memory leaks through proper cleanup
- Provide type-safe event interfaces
- Support complex event flows across process boundaries

## Core Event Patterns

### 1. Typed Event Interfaces

**Location**: `src/proxy/proxy-manager.ts`

```typescript
export interface ProxyManagerEvents {
  // DAP events
  'stopped': (threadId: number, reason: string, data?: DebugProtocol.StoppedEvent['body']) => void;
  'continued': () => void;
  'terminated': () => void;
  'exited': () => void;

  // Proxy lifecycle events
  'initialized': () => void;
  'error': (error: Error) => void;
  'exit': (code: number | null, signal?: string) => void;

  // Status events
  'dry-run-complete': (command: string, script: string) => void;
  'adapter-configured': () => void;
  'dap-event': (event: string, body: unknown) => void;
}

// Typed event emitter methods (subset of IProxyManager)
export interface IProxyManager extends EventEmitter {
  on<K extends keyof ProxyManagerEvents>(
    event: K,
    listener: ProxyManagerEvents[K]
  ): this;

  emit<K extends keyof ProxyManagerEvents>(
    event: K,
    ...args: Parameters<ProxyManagerEvents[K]>
  ): boolean;
}
```

This pattern provides:
- Type safety for event names and parameters
- IntelliSense support in IDEs
- Compile-time checking of event usage

### 2. WeakMap Pattern for Handler Tracking

**Location**: `src/session/session-manager-core.ts`

> **Note**: `SessionManager` is now a thin facade. Core logic including event handler setup lives in `SessionManagerCore` (in `session-manager-core.ts`).

```typescript
// WeakMap to store event handlers for cleanup
private sessionEventHandlers = new WeakMap<ManagedSession, Map<string, (...args: any[]) => void>>();

private setupProxyEventHandlers(
  session: ManagedSession, 
  proxyManager: IProxyManager,
  effectiveLaunchArgs: Partial<CustomLaunchRequestArguments>
): void {
  const sessionId = session.id;
  const handlers = new Map<string, (...args: any[]) => void>();

  // Named function for stopped event
  const handleStopped = (threadId: number, reason: string) => {
    this.logger.debug(`[SessionManager] 'stopped' event handler called for session ${sessionId}`);
    this.logger.info(`[ProxyManager ${sessionId}] Stopped event: thread=${threadId}, reason=${reason}`);
    
    // Handle auto-continue for stopOnEntry=false
    if (!effectiveLaunchArgs.stopOnEntry && reason === 'entry') {
      this.logger.info(`[ProxyManager ${sessionId}] Auto-continuing (stopOnEntry=false)`);
      this.continue(sessionId).catch(err => {
        this.logger.error(`[ProxyManager ${sessionId}] Error auto-continuing:`, err);
      });
    } else {
      this._updateSessionState(session, SessionState.PAUSED);
    }
  };
  proxyManager.on('stopped', handleStopped);
  handlers.set('stopped', handleStopped);

  // Named function for continued event
  const handleContinued = () => {
    this.logger.debug(`[SessionManager] 'continued' event handler called for session ${sessionId}`);
    this.logger.info(`[ProxyManager ${sessionId}] Continued event`);
    this._updateSessionState(session, SessionState.RUNNING);
  };
  proxyManager.on('continued', handleContinued);
  handlers.set('continued', handleContinued);

  // ... more handlers

  // Store handlers in WeakMap
  this.sessionEventHandlers.set(session, handlers);
  this.logger.debug(`[SessionManager] Attached ${handlers.size} event handlers for session ${sessionId}`);
}
```

Benefits of WeakMap:
- Automatic garbage collection when session is deleted
- No need to manually clean up if session object is lost
- Prevents memory leaks from forgotten handlers

### 3. Comprehensive Cleanup Pattern

**Location**: `src/session/session-manager-core.ts`

```typescript
private cleanupProxyEventHandlers(session: ManagedSession, proxyManager: IProxyManager): void {
  // Safety check to prevent double cleanup
  if (!this.sessionEventHandlers.has(session)) {
    this.logger.debug(`[SessionManager] Cleanup already performed for session ${session.id}`);
    return;
  }

  const handlers = this.sessionEventHandlers.get(session);
  if (!handlers) {
    this.logger.debug(`[SessionManager] No handlers found for session ${session.id}`);
    return;
  }
  
  let removedCount = 0;
  let failedCount = 0;
  
  handlers.forEach((handler, eventName) => {
    try {
      this.logger.debug(`[SessionManager] Removing ${eventName} listener for session ${session.id}`);
      proxyManager.removeListener(eventName, handler);
      removedCount++;
    } catch (error) {
      this.logger.error(`[SessionManager] Failed to remove ${eventName} listener for session ${session.id}:`, error);
      failedCount++;
      // Continue cleanup despite errors
    }
  });
  
  this.logger.info(`[SessionManager] Cleanup complete for session ${session.id}: ${removedCount} removed, ${failedCount} failed`);
  this.sessionEventHandlers.delete(session);
}
```

Key aspects:
- Safety checks prevent double cleanup
- Continue cleanup even if some removals fail
- Track success/failure counts for debugging
- Remove from WeakMap after cleanup

## Cross-Process Event Communication

### IPC Message Events

**Location**: `src/proxy/proxy-manager.ts`

```typescript
private setupEventHandlers(): void {
  if (!this.proxyProcess) return;

  // Handle IPC messages
  this.proxyProcess.on('message', (rawMessage: unknown) => {
    this.handleProxyMessage(rawMessage);
  });

  // Handle stderr
  this.proxyProcess.stderr?.on('data', (data: Buffer | string) => {
    this.logger.error(`[ProxyManager STDERR] ${data.toString().trim()}`);
  });

  // Handle exit
  this.proxyProcess.on('exit', (code: number | null, signal: string | null) => {
    this.logger.info(`[ProxyManager] Proxy exited. Code: ${code}, Signal: ${signal}`);
    this.handleProxyExit(code, signal);
  });

  // Handle errors
  this.proxyProcess.on('error', (err: Error) => {
    this.logger.error(`[ProxyManager] Proxy error:`, err);
    this.emit('error', err);
    this.cleanup();
  });
}
```

### Message-Based Event Forwarding

**Location**: `src/proxy/proxy-manager.ts`

```typescript
private handleDapEvent(message: ProxyDapEventMessage): void {
  this.logger.info(`[ProxyManager] DAP event: ${message.event}`, message.body);

  switch (message.event) {
    case 'stopped':
      const threadId = message.body?.threadId;
      const reason = message.body?.reason || 'unknown';
      if (threadId) {
        this.currentThreadId = threadId;
      }
      this.emit('stopped', threadId, reason, message.body);
      break;
    
    case 'continued':
      this.emit('continued');
      break;
    
    case 'terminated':
      this.emit('terminated');
      break;
    
    case 'exited':
      this.emit('exited');
      break;
    
    // Forward other events as generic DAP events
    default:
      this.emit('dap-event' as any, message.event, message.body);
  }
}
```

## Event-Driven State Management

### State Transitions via Events

**Location**: `src/session/session-manager-core.ts` (within `setupProxyEventHandlers`)

```typescript
// Named function for stopped event
const handleStopped = (threadId: number, reason: string) => {
  this.logger.info(`[ProxyManager ${sessionId}] Stopped event: thread=${threadId}, reason=${reason}`);
  
  // Handle auto-continue for stopOnEntry=false
  if (!effectiveLaunchArgs.stopOnEntry && reason === 'entry') {
    this.logger.info(`[ProxyManager ${sessionId}] Auto-continuing (stopOnEntry=false)`);
    this.continue(sessionId).catch(err => {
      this.logger.error(`[ProxyManager ${sessionId}] Error auto-continuing:`, err);
    });
  } else {
    this._updateSessionState(session, SessionState.PAUSED);
  }
};
```

### Event-Based Lifecycle Management

**Location**: `src/proxy/proxy-manager.ts`

```typescript
const cleanup = () => {
  clearTimeout(timeout);
  this.removeListener('initialized', handleInitialized);
  this.removeListener('dry-run-complete', handleDryRun);
  this.removeListener('error', handleError);
  this.removeListener('exit', handleExit);
};

const handleInitialized = () => {
  this.isInitialized = true;
  cleanup();
  resolve();
};

const handleDryRun = () => {
  cleanup();
  resolve();
};

const handleError = (error: Error) => {
  cleanup();
  reject(error);
};

const handleExit = (code: number | null, signal?: string) => {
  cleanup();
  if (this.isDryRun && code === 0) {
    // Normal exit for dry run
    resolve();
  } else {
    reject(new Error(`Proxy exited during initialization. Code: ${code}, Signal: ${signal}`));
  }
};
```

## Promise-Based Event Waiting

### One-Time Event Promises

**Location**: `src/session/session-manager-operations.ts`

```typescript
// Wait for stopped event
return new Promise((resolve) => {
  const timeout = setTimeout(() => {
    this.logger.warn(`[SM stepOver ${sessionId}] Timeout waiting for stopped event`);
    resolve({ 
      success: false, 
      error: ErrorMessages.stepTimeout(5), 
      state: session.state 
    });
  }, 5000);
  
  session.proxyManager?.once('stopped', () => {
    clearTimeout(timeout);
    this.logger.info(`[SM stepOver ${sessionId}] Step completed. Current state: ${session.state}`);
    resolve({ success: true, state: session.state, data: { message: "Step over completed." } });
  });
});
```

### Event Race Conditions

**Location**: `src/session/session-manager-operations.ts`

```typescript
// Wait for adapter to be configured or first stop event
const waitForReady = new Promise<void>((resolve) => {
  let resolved = false;
  
  const handleStopped = () => {
    if (!resolved) {
      resolved = true;
      this.logger.info(`[SessionManager] Session ${sessionId} stopped on entry`);
      resolve();
    }
  };
  
  const handleConfigured = () => {
    if (!resolved && !dapLaunchArgs?.stopOnEntry) {
      resolved = true;
      this.logger.info(`[SessionManager] Session ${sessionId} running (stopOnEntry=false)`);
      resolve();
    }
  };
  
  session.proxyManager?.once('stopped', handleStopped);
  session.proxyManager?.once('adapter-configured', handleConfigured);
  
  // Timeout after 30 seconds
  setTimeout(() => {
    if (!resolved) {
      resolved = true;
      session.proxyManager?.removeListener('stopped', handleStopped);
      session.proxyManager?.removeListener('adapter-configured', handleConfigured);
      this.logger.warn(ErrorMessages.adapterReadyTimeout(30));
      resolve();
    }
  }, 30000);
});
```

## Testing Event Patterns

### Testing Event Emissions

**Location**: `tests/unit/proxy/proxy-manager-lifecycle.test.ts`

```typescript
it('should emit exit event when proxy process exits', async () => {
  // Setup
  fakeLauncher.prepareProxy((proxy) => {
    setTimeout(() => {
      proxy.simulateMessage({
        type: 'status',
        sessionId: defaultConfig.sessionId,
        status: 'adapter_configured_and_launched'
      });
    }, 50);
  });

  await proxyManager.start(defaultConfig);

  // Create promise to capture event
  const exitPromise = new Promise<{ code: number; signal?: string }>((resolve) => {
    proxyManager.once('exit', (code, signal) => resolve({ code, signal }));
  });

  // Trigger event
  const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
  fakeProxy.simulateExit(0, 'SIGTERM');

  // Assert
  const result = await exitPromise;
  expect(result.code).toBe(0);
  expect(result.signal).toBe('SIGTERM');
  expect(proxyManager.isRunning()).toBe(false);
});
```

### Testing Event Cleanup

```typescript
it('should clean up event handlers on stop', async () => {
  // Track handler cleanup
  const removeListenerSpy = vi.spyOn(proxyManager, 'removeListener');
  
  await proxyManager.start(defaultConfig);
  await proxyManager.stop();
  
  // Verify handlers were removed
  expect(removeListenerSpy).toHaveBeenCalledWith('initialized', expect.any(Function));
  expect(removeListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
  expect(removeListenerSpy).toHaveBeenCalledWith('exit', expect.any(Function));
});
```

## Best Practices

1. **Use Named Functions** - Makes debugging easier and prevents duplicate handlers
2. **Always Clean Up** - Remove event listeners when no longer needed
3. **Use WeakMap for Tracking** - Automatic cleanup when parent object is GC'd
4. **Type Your Events** - Define interfaces for event names and parameters
5. **Handle Race Conditions** - Use flags to prevent multiple resolutions
6. **Set Timeouts** - Prevent hanging on events that never fire
7. **Log Event Flow** - Add debug logging for event emission and handling
8. **Test Event Scenarios** - Cover both happy path and error cases

## Anti-Patterns to Avoid

### ❌ Anonymous Handlers Without Cleanup
```typescript
// Bad - no way to remove this handler
emitter.on('event', () => {
  doSomething();
});
```

### ❌ Memory Leaks from Persistent Handlers
```typescript
// Bad - handler keeps reference to large object
class BadComponent {
  constructor() {
    this.largeData = new Array(1000000);
    
    // This handler will prevent GC of this instance
    globalEmitter.on('event', () => {
      console.log(this.largeData.length);
    });
  }
}
```

### ❌ Race Conditions in Event Handling
```typescript
// Bad - multiple handlers might resolve
emitter.on('event1', () => resolve(1));
emitter.on('event2', () => resolve(2)); // Double resolution!
```

### ✅ Correct Patterns
```typescript
// Good - named function with cleanup
const handleEvent = () => {
  doSomething();
};
emitter.on('event', handleEvent);

// Later...
emitter.removeListener('event', handleEvent);

// Good - prevent double resolution
let resolved = false;
const handler = () => {
  if (!resolved) {
    resolved = true;
    resolve();
  }
};

// Good - automatic cleanup with WeakMap
const handlers = new WeakMap();
handlers.set(session, new Map([['event', handler]]));
```

## Advanced Patterns

### Event Aggregation

```typescript
// Collect multiple events before processing
const events: DapEvent[] = [];
let flushTimeout: NodeJS.Timeout;

const handleDapEvent = (event: DapEvent) => {
  events.push(event);
  
  clearTimeout(flushTimeout);
  flushTimeout = setTimeout(() => {
    processEventBatch(events);
    events.length = 0;
  }, 100);
};
```

### Event Replay for Testing

```typescript
class EventRecorder {
  private events: Array<{ name: string; args: any[] }> = [];
  
  record(emitter: EventEmitter, eventName: string) {
    emitter.on(eventName, (...args) => {
      this.events.push({ name: eventName, args });
    });
  }
  
  replay(emitter: EventEmitter) {
    this.events.forEach(({ name, args }) => {
      emitter.emit(name, ...args);
    });
  }
}
```

## Summary

The event management pattern in MCP Debug Server:
- Prevents memory leaks through careful handler tracking
- Provides type-safe event interfaces
- Enables loose coupling between components
- Supports complex cross-process communication

By following these patterns, the system maintains clean event handling without memory leaks or race conditions.

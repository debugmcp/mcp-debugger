# Event Management Pattern in MCP Debug Server

> **Note**: The code snippets in this document illustrate design-intent patterns. They are simplified from the actual source and may not exactly match current signatures or file locations. Always consult the source files referenced in each section for authoritative details.

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

`ProxyManagerEvents` is the map of event name to listener signature that makes
those two generics type-safe. It is deliberately **not** reproduced here: the
signatures move (`'exited'` gained an optional `exitCode`, `'exit'` an `expected`
flag, and `'output'`, `'breakpoint'`, `'adapter-capabilities'`,
`'function-breakpoints-synced'` and `'breakpoints-synced'` were added), and a
second copy only rots. Read the live definition in `src/proxy/proxy-manager.ts`;
treat any transcription of it elsewhere in the docs as already behind.

This pattern provides:
- Type safety for event names and parameters
- IntelliSense support in IDEs
- Compile-time checking of event usage

### 2. WeakMap Pattern for Handler Tracking

**Location**: `src/session/session-manager-core.ts`

> **Note**: `SessionManager` is a thin facade atop a 4-class inheritance hierarchy: `SessionManagerCore` → `SessionManagerData` → `SessionManagerOperations` → `SessionManager`. Core logic including event handler setup lives in `SessionManagerCore` (in `session-manager-core.ts`).

```typescript
// WeakMap to store event handlers for cleanup
protected sessionEventHandlers = new WeakMap<ManagedSession, Map<string, (...args: any[]) => void>>();

protected setupProxyEventHandlers(
  session: ManagedSession, 
  proxyManager: IProxyManager,
  effectiveLaunchArgs: Partial<CustomLaunchRequestArguments>
): void {
  const sessionId = session.id;
  const handlers = new Map<string, (...args: any[]) => void>();

  // Named function for stopped event (third parameter is the full stoppedBody from DAP)
  const handleStopped = (threadId: number | undefined, reason: string, stoppedBody?: unknown) => {
    this.logger.debug(`[SessionManager] 'stopped' event handler called for session ${sessionId}`);
    this.logger.info(`[ProxyManager ${sessionId}] Stopped event: thread=${threadId}, reason=${reason}`);

    // Handle auto-continue for stopOnEntry=false
    if (!effectiveLaunchArgs.stopOnEntry && reason === 'entry') {
      this._updateSessionState(session, SessionState.PAUSED);
      this.handleAutoContinue(sessionId).catch(err => { /* log error */ });
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

    // Guard against stale continued events arriving after a breakpoint stop.
    if (session.state === SessionState.PAUSED) {
      return; // Keep PAUSED state
    }
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
- Handler bookkeeping entries become eligible for garbage collection once their `ManagedSession` key is unreachable
- Avoids retaining bookkeeping data for sessions that no longer exist

Note: WeakMap only governs the bookkeeping map's keys. It does **not** automatically remove listeners from the `proxyManager` emitter. Explicit listener removal via `cleanupProxyEventHandlers` is still required to prevent handler leaks.

### 3. Comprehensive Cleanup Pattern

**Location**: `src/session/session-manager-core.ts`

```typescript
protected cleanupProxyEventHandlers(session: ManagedSession, proxyManager: IProxyManager): void {
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

// Note: ProxyManager also tracks IPC lifecycle events internally:
// - 'ipc-send-start': Emitted when an IPC message begins sending
// - 'ipc-send-complete': Emitted when IPC send succeeds
// - 'ipc-send-failed': Emitted when IPC send fails
// - 'ipc-send-error': Emitted on IPC send error
// These are used for internal diagnostics and request correlation.
```

### Message-Based Event Forwarding

**Location**: `src/proxy/proxy-manager.ts`

```typescript
private handleDapEvent(message: ProxyDapEventMessage): void {
  this.logger.info(`[ProxyManager] DAP event: ${message.event}`, message.body);

  switch (message.event) {
    case 'stopped':
      const stoppedBody = message.body as { threadId?: number; reason?: string } | undefined;
      const threadIdMaybe = (typeof stoppedBody?.threadId === 'number') ? stoppedBody!.threadId! : undefined;
      const reason = stoppedBody?.reason || 'unknown';
      if (typeof threadIdMaybe === 'number') {
        this.currentThreadId = threadIdMaybe;
      }
      // Do not fabricate a threadId; emit undefined if adapter omitted it
      this.emit('stopped', threadIdMaybe, reason, stoppedBody);
      break;
    
    case 'continued':
      this.emit('continued');
      break;
    
    case 'terminated':
      this.emit('terminated');
      break;
    
    case 'exited':
      // The debuggee's exit code is forwarded, not dropped.
      this.emit('exited', exitedBody?.exitCode);
      break;
    
    case 'output':
      this.emit('output', category, output);
      break;
    
    case 'breakpoint':
      this.emit('breakpoint', message.body);
      break;
    
    // Forward other events as generic DAP events
    default:
      this.emit('dap-event', message.event, message.body);
  }
}
```

## Event-Driven State Management

### State Transitions via Events

**Location**: `src/session/session-manager-core.ts` (within `setupProxyEventHandlers`)

```typescript
// Named function for stopped event
const handleStopped = (threadId: number | undefined, reason: string) => {
  this.logger.info(`[ProxyManager ${sessionId}] Stopped event: thread=${threadId}, reason=${reason}`);

  // Auto-continue on entry stops when stopOnEntry=false
  if (!effectiveLaunchArgs.stopOnEntry && reason === 'entry') {
    this._updateSessionState(session, SessionState.PAUSED);
    this.handleAutoContinue(sessionId).catch(err => { /* log error */ });
  } else {
    this._updateSessionState(session, SessionState.PAUSED);
  }
};
```

When a 'stopped' event fires with `reason='entry'` and `stopOnEntry=false`, the session transitions synchronously to PAUSED and then `handleAutoContinue(sessionId)` calls `this.continue(sessionId)` to resume execution. The synchronous PAUSED transition is required because `continue()` guards on `session.state === SessionState.PAUSED`.

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
  // Unconditional: an exit during initialization is always a failure, including a
  // code-0 one. A clean dry run is acknowledged by an explicit dry_run_complete
  // status, not by the process merely exiting quietly (issue #596).
  let errorMessage = `Proxy exited during initialization. Code: ${code}, Signal: ${signal}`;
  // ... the last few stderr lines are appended here, capped (issue #146)
  reject(new Error(errorMessage));
};
```

## Promise-Based Event Waiting

### One-Time Event Promises

**Location**: `src/session/execution/execution-controller.ts`

Five events can end a step wait — `stopped`, `terminated`, `exited`, `exit`, and
the grace-window timer — so the listeners are registered with `on` behind a
single `settle()` once-guard rather than with `once`. `stepGraceMs` is a field on
the `SessionManagerOperations` facade, read here through `this.ctx.tunables` so a
test that shrinks it on a live instance is observed.

```typescript
// Wait for the stop, with a grace window rather than a hard deadline: a step
// that outlives the window returns a truthful `pending` success and completes
// asynchronously via the persistent handleStopped listener.
const timeout = setTimeout(() => {
  if (stopSeen) return; // the stop landed; the stop path owns the settle
  this.ctx.logger.info(
    `[SM ${options.logTag} ${sessionId}] Step still running after grace window; completing asynchronously`
  );
  settle({
    success: true,
    state: session.state, // still RUNNING
    data: {
      message: ErrorMessages.stepStillRunning(this.ctx.tunables.stepGraceMs / 1000),
      pending: true,
    },
  });
}, this.ctx.tunables.stepGraceMs);

proxyManager.on('stopped', onStopped);
proxyManager.on('terminated', onTerminated);
proxyManager.on('exited', onExited);
proxyManager.on('exit', onExit);
```

### Event Race Conditions

**Location**: `src/session/launch/launch-readiness.ts` (`waitForLaunchReadiness`)

```typescript
// Wait for the adapter to be configured, the first stop event, or termination.
// Readiness can be satisfied by: stopped, adapter-configured, terminated,
// exited, or exit. The wait never rejects — every outcome resolves, including
// the 30s ceiling, so the caller reports whatever state the session is in
// rather than failing a launch that is merely slow.
// `session.proxyManager` is re-read on every access: a terminal event handler
// may null it while the wait is in flight.
return new Promise<void>((resolve) => {
  let resolved = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const cleanup = () => {
    if (timeoutId) clearTimeout(timeoutId);
    session.proxyManager?.removeListener('stopped', handleStopped);
    session.proxyManager?.removeListener('adapter-configured', handleConfigured);
    session.proxyManager?.removeListener('terminated', handleTerminated);
    session.proxyManager?.removeListener('exited', handleExited);
    session.proxyManager?.removeListener('exit', handleExit);
  };

  const handleStopped = () => {
    if (!resolved) { resolved = true; cleanup(); resolve(); }
  };
  const handleConfigured = () => {
    // The adapter policy decides whether "configured and running" counts as
    // ready; without one, it does unless the caller asked to stop on entry.
    const readyOnRunning = policy.isSessionReady
      ? policy.isSessionReady(SessionState.RUNNING, { stopOnEntry: dapLaunchArgs?.stopOnEntry })
      : !dapLaunchArgs?.stopOnEntry;
    if (!resolved && readyOnRunning) { resolved = true; cleanup(); resolve(); }
  };
  // handleTerminated / handleExited / handleExit follow the same shape.

  // Checked BEFORE any listener is registered: the caller decided readiness
  // synchronously just before this call and nothing has been awaited since,
  // so the only state worth re-checking is a launch that is already terminal
  // — and settling here costs no registrations to remove.
  const currentState = ctx.getSession(sessionId).state;
  if (currentState === SessionState.STOPPED || currentState === SessionState.ERROR) {
    resolved = true;
    resolve();
    return;
  }

  session.proxyManager?.once('stopped', handleStopped);
  session.proxyManager?.once('adapter-configured', handleConfigured);
  session.proxyManager?.once('terminated', handleTerminated);
  session.proxyManager?.once('exited', handleExited);
  session.proxyManager?.once('exit', handleExit);

  // Ceiling after 30 seconds: log and resolve, never reject.
  timeoutId = setTimeout(() => {
    if (!resolved) {
      resolved = true; cleanup();
      ctx.logger.warn(ErrorMessages.adapterReadyTimeout(30));
      resolve();
    }
  }, 30000);
});
```

## Testing Event Patterns

### Testing Event Emissions

**Location**: the ProxyManager unit suite — `tests/unit/proxy/proxy-manager.start.test.ts`,
`tests/unit/proxy/proxy-manager.handshake.test.ts`,
`tests/unit/proxy/proxy-manager-message-handling.test.ts` and
`tests/unit/proxy/proxy-manager.branch-coverage.test.ts`

Two shapes are in use. `proxy-manager-message-handling.test.ts` drives a
`TestProxyManager` (`tests/unit/test-utils/test-proxy-manager.ts`) — a real
`ProxyManager` with `start()`/`stop()` overridden so no process is spawned, plus
a `simulateMessage()` that feeds the IPC handler directly. The assertion is
simply that the right typed event came out the other side:

```typescript
it('should handle valid status messages', () => {
  const statusMessage = {
    type: 'status',
    sessionId: 'test-session',
    status: 'adapter_configured_and_launched'
  };

  let adapterConfiguredEmitted = false;
  proxyManager.on('adapter-configured', () => {
    adapterConfiguredEmitted = true;
  });

  // Simulate message from proxy process
  proxyManager.simulateMessage(statusMessage);

  expect(adapterConfiguredEmitted).toBe(true);
});

it('should handle clean proxy exit', async () => {
  let exitEmitted = false;
  proxyManager.on('exit', () => {
    exitEmitted = true;
  });

  await proxyManager.stop();

  expect(exitEmitted).toBe(true);
  expect(proxyManager.isRunning()).toBe(false);
});
```

The three siblings reach the same events by other routes, none of them spawning
a process either: `proxy-manager.start.test.ts` builds a real `ProxyManager`
over a hand-rolled `FakeProxyProcess` (an `EventEmitter` implementing
`IProxyProcess`) handed back by a `launchProxy` spy, then emits `'message'` on
the fake to script the handshake; `proxy-manager.branch-coverage.test.ts`
assigns a `StubProxyProcess` onto the manager's private `proxyProcess` field and
calls the private `handleProxyMessage` directly; and
`proxy-manager.handshake.test.ts` spies on `sendCommand` and emits
`'init-received'` on the manager itself, driving `sendInitWithRetry`'s backoff
under fake timers. A reusable off-the-shelf `FakeProxyProcessLauncher` — with
`prepareProxy()`, `getLastLaunchedProxy()` and `simulateExit()` — lives in
`tests/implementations/test/fake-process-launcher.ts` for suites that would
rather not hand-roll one.

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
3. **Use WeakMap for Tracking** - Bookkeeping entries become GC-eligible when key is unreachable (but explicit listener removal is still required)
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

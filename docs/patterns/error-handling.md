# Error Handling Pattern in MCP Debug Server

This document describes the error handling patterns and strategies used throughout the MCP Debug Server codebase.

## Overview

The error handling system is designed to:
- Provide user-friendly error messages with troubleshooting guidance
- Maintain consistent error formatting across the codebase
- Enable proper error propagation and recovery
- Support comprehensive error logging and debugging

## Centralized Error Messages

### Location: `src/utils/error-messages.ts`

Reusable timeout-related error message factories are centralized in this module. Other user-facing error text (e.g., from worker, proxy, or session error paths) is defined inline elsewhere in the codebase. The module's primary invariant is consistency for timeout messages: callers should source timeout text from here instead of inlining strings.

```typescript
export const ErrorMessages = {
  dapRequestTimeout: (command: string, timeout: number) => 
    `Debug adapter did not respond to '${command}' request within ${timeout}s. ` +
    `This typically means the debug adapter has crashed or lost connection. ` +
    `Try restarting your debug session. If the problem persists, check the debug adapter logs.`,

  dapRequestTimeoutHint: () =>
    `If the operation is expected to take this long, retry with a larger 'timeout' (ms) argument. ` +
    `Note the operation may still be running in the debuggee.`,
  
  proxyInitTimeout: (timeout: number) =>
    `Debug proxy initialization did not complete within ${timeout}s. ` +
    `This may indicate that the debug adapter failed to start or is not properly configured. ` +
    `Check that the required debug adapter is installed and accessible.`,
  
  stepStillRunning: (graceSeconds: number) =>
    `Step dispatched; the program is still executing after ${graceSeconds}s ` +
    `(e.g. stepping over a long-running call). The session remains 'running' and will ` +
    `become 'paused' when the step completes. Check the session state, or call ` +
    `pause_execution to interrupt.`,

  pausePending: (graceSeconds: number) =>
    `Pause requested; no 'stopped' event within ${graceSeconds}s ` +
    `(the program may be blocked in native code or a syscall). The session will report ` +
    `'paused' once the stop lands. Check the session state to confirm.`,

  attachVerifyFailed: (timeoutMs: number, lastFailure: string) =>
    `Attach did not become debuggable: no threads reported within ${timeoutMs}ms ` +
    `(last failure: ${lastFailure}). If the target is just slow to become debuggable ` +
    `(e.g. a busy or warming JVM), retry with a larger 'verifyTimeout' (ms) on attach_to_process.`,
  
  adapterReadyTimeout: (timeout: number) =>
    `Timed out waiting for debug adapter to be ready after ${timeout}s. ` +
    `The adapter may have failed to start properly. ` +
    `Check the debug logs for more details.`
};
```

### Benefits of Centralization

1. **Consistency** - Timeout-related errors follow a consistent centralized format defined in error-messages.ts
2. **Maintainability** - Easy to update error messages
3. **Testability** - Can verify exact error messages in tests
4. **User Experience** - Consistent troubleshooting guidance

## Error Handling Layers

### 1. Process-Level Error Handling

Global error handlers for the proxy process are registered by **`ProxyRunner.setupGlobalErrorHandlers()`** (`src/proxy/dap-proxy-core.ts`), wired up by `dap-proxy-entry.ts`. It logs errors and sends IPC messages, but does **not** exit the process for unhandled rejections. All handlers are registered on the runner's injected process handle (`this.proc`, defaulting to the global `process` — issue #183), so unit tests can drive them through a fake without touching the real process object.

```typescript
setupGlobalErrorHandlers(
  errorShutdown: () => Promise<void>,
  getCurrentSessionId: () => string | null
): void {
  // Uncaught exception handler - exits after shutdown
  this.proc.on('uncaughtException', (error: Error) => {
    this.logger.error('[ProxyRunner] Uncaught exception:', error);
    const sessionId = getCurrentSessionId() || 'unknown';

    this.dependencies.messageSender.send({
      type: 'error',
      message: `Proxy uncaught exception: ${error.message}`,
      sessionId
    });

    errorShutdown().finally(() => {
      this.proc.exit(1);
    });
  });

  // Unhandled rejection handler - logs but does NOT exit
  this.proc.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    this.logger.error('[ProxyRunner] Unhandled rejection:', { reason, promise });
    const sessionId = getCurrentSessionId() || 'unknown';

    this.dependencies.messageSender.send({
      type: 'error',
      message: `Proxy unhandled rejection: ${reason}`,
      sessionId
    });
  });

  // Graceful shutdown on signals
  this.proc.on('SIGTERM', () => {
    this.logger.info('[ProxyRunner] Received SIGTERM, shutting down gracefully');
    errorShutdown().finally(() => {
      this.proc.exit(0);
    });
  });

  this.proc.on('SIGINT', () => {
    this.logger.info('[ProxyRunner] Received SIGINT, shutting down gracefully');
    errorShutdown().finally(() => {
      this.proc.exit(0);
    });
  });
}
```

(A divergent standalone `setupGlobalErrorHandlers()` used to exist in `src/proxy/dap-proxy-dependencies.ts`; it was dead in production and removed with issue #183.)

### 2. Component-Level Error Handling

**Example**: SessionManager error handling (`src/session/session-manager-operations.ts`)

```typescript
async startDebugging(
  sessionId: string, 
  scriptPath: string, 
  scriptArgs?: string[], 
  dapLaunchArgs?: Partial<CustomLaunchRequestArguments>, 
  dryRunSpawn?: boolean
): Promise<DebugResult> {
  const session = this._getSessionById(sessionId);
  
  try {
    // Start the proxy manager
    await this.startProxyManager(session, scriptPath, scriptArgs, dapLaunchArgs, dryRunSpawn);
    
    // ... rest of logic
    
    return { 
      success: true, 
      state: session.state, 
      data: { message: `Debugging started for ${scriptPath}` } 
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : 'No stack available';
    
    this.logger.error(`[SessionManager] Error during startDebugging for session ${sessionId}: ${errorMessage}. Stack: ${errorStack}`);
    
    this._updateSessionState(session, SessionState.ERROR);
    
    if (session.proxyManager) {
      await session.proxyManager.stop();
      session.proxyManager = undefined;
    }
    
    return { success: false, error: errorMessage, state: session.state };
  }
}
```

### 3. Timeout Error Handling

**Example**: ProxyManager DAP request timeout (`src/proxy/proxy-manager.ts`)

A DAP request rides a three-layer timeout stack, ordered so the layer with the
most actionable error message fires first:

1. **Socket** (`minimal-dap.ts`) — 30s default, per-request `timeoutMs` override
2. **Worker request tracker** (`dap-proxy-request-tracker.ts`) — 30s default, same override; its
   `Request '<cmd>' timed out after Ns` failure is what callers normally see
3. **Parent** (`proxy-manager.ts`) — override (or 30s default) **plus a 5s margin**, a backstop
   that only fires if the worker never responds at all

`evaluate_expression` and `redefine_classes` expose the override as a `timeout` (ms) tool
argument (issue #142). `SessionManagerOperations` validates it (positive, finite, clamped to
600000) and passes `{ timeoutMs }` to `sendDapRequest`, which threads it over IPC
(`DapCommandPayload.timeoutMs`) to the worker and socket. On a timeout failure those
operations append `ErrorMessages.dapRequestTimeoutHint()` naming the `timeout` argument.
The margin invariant (worker fires before parent) must hold for any new override plumbing.

```typescript
// Timeout handler. The worker/socket timeout (timeoutMs, default 30s)
// fires first and produces the actionable error; this parent timer is a
// backstop that only fires if the worker never responds at all.
const effectiveTimeoutMs =
  (options?.timeoutMs ?? this.defaultDapRequestTimeoutMs) + this.dapParentMarginMs;
setTimeout(() => {
  if (this.pendingDapRequests.has(requestId)) {
    this.pendingDapRequests.delete(requestId);
    reject(new Error(ErrorMessages.dapRequestTimeout(command, Math.round(effectiveTimeoutMs / 1000))));
  }
}, effectiveTimeoutMs);
```

**Example**: SessionManager step operation grace window (`src/session/session-manager-operations.ts`)

Note: a step that outlives the grace window is *not* an error — the debuggee may
legitimately run for a long time (e.g. stepping over a slow call). The tool
returns a truthful `pending` success and the step completes asynchronously via
the persistent `handleStopped` listener in `session-manager-core.ts`.

```typescript
return new Promise((resolve) => {
  const timeout = setTimeout(() => {
    this.logger.info(`[SM stepOver ${sessionId}] Step still running after grace window; completing asynchronously`);
    resolve({
      success: true,
      state: session.state, // still RUNNING
      data: {
        message: ErrorMessages.stepStillRunning(this.stepGraceMs / 1000),
        pending: true,
      },
    });
  }, this.stepGraceMs);
  
  session.proxyManager?.once('stopped', () => {
    clearTimeout(timeout);
    this.logger.info(`[SM stepOver ${sessionId}] Step completed. Current state: ${session.state}`);
    resolve({ success: true, state: session.state, data: { message: "Step over completed." } });
  });
});
```

**Example**: SessionManager attach verification window (`src/session/session-manager-operations.ts`)

After an attach handshake, DAP `threads` is polled until the debugger reports at
least one thread. If the window elapses without threads, the attach is reported
as a failure and the proxy is torn down (issue #124 — a debugger with no
threads is not usable, and reporting "paused" would be a lie). Because a slow
target (e.g. a busy or warming JVM) can legitimately need longer than the
default window, the window is caller-configurable (issue #143):

- The default lives in the protected, test-shrinkable field
  `attachVerifyTimeoutMs` (5s), following the `stepGraceMs`/`pauseGraceMs`
  field pattern.
- Callers override it per attach via the `verifyTimeout` (ms) argument on
  `attach_to_process` / `create_debug_session`; the value is validated
  (positive finite number) and clamped to 10 minutes.
- The failure text comes from `ErrorMessages.attachVerifyFailed(timeoutMs,
  lastFailure)`, which names the `verifyTimeout` knob so a caller that hit the
  window on a slow target knows how to retry.

## Error Response Patterns

### DebugResult Pattern

Most operations return a standardized `DebugResult`:

```typescript
interface DebugResult {
  success: boolean;
  state: SessionState;
  error?: string;
  data?: unknown;
  canContinue?: boolean;
  // Machine-readable error identity for tests and callers (avoid string assertions)
  errorType?: string; // e.g., 'PythonNotFoundError'
  errorCode?: number; // e.g., -32602 (MCP InvalidParams)
}
```

Example usage:

```typescript
// Success case
return { 
  success: true, 
  state: session.state, 
  data: { message: "Operation completed successfully" } 
};

// Error case
return { 
  success: false, 
  error: "Detailed error message", 
  state: session.state 
};
```

### Event Handler Error Management

**Location**: `src/session/session-manager-core.ts`

```typescript
protected cleanupProxyEventHandlers(session: ManagedSession, proxyManager: IProxyManager): void {
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

## Logging Strategy

### Structured Logging

All errors are logged with appropriate context:

```typescript
this.logger.error(`[Component] Error description`, {
  sessionId,
  operation: 'operationName',
  error: error.message,
  stack: error.stack
});
```

### Log Levels

- **ERROR**: Unrecoverable errors, exceptions
- **WARN**: Recoverable issues, timeouts
- **INFO**: Normal operations, state changes
- **DEBUG**: Detailed troubleshooting information

## Error Recovery Patterns

### 1. Graceful Degradation

**Example**: Proxy manager stop operation

```typescript
async stop(): Promise<void> {
  if (!this.proxyProcess) {
    // No proxy process, but still dispose adapter to release instance slot
    this.cleanup();
    return;
  }

  this.logger.info(`[ProxyManager] Stopping proxy for session ${this.sessionId}`);

  // Give in-flight DAP requests a bounded window to settle before we stop
  // processing messages and cancel them (issue #122 follow-up).
  await this.drainPendingDapRequests(this.stopDrainTimeoutMs);

  // The proxy may have exited while we drained; re-check before touching
  // the process handle.
  const process = this.proxyProcess;
  if (!process) {
    this.isStopped = true;
    this.cleanup();
    return;
  }

  // Mark as shutting down to stop processing new messages, then clean up
  // (cancels whatever is still pending after the drain)
  this.isStopped = true;
  this.cleanup();

  // Send terminate command
  try {
    process.send({ cmd: 'terminate', sessionId: this.sessionId });
  } catch (error) {
    this.logger.error(`[ProxyManager] Error sending terminate command:`, error);
    // Continue with force kill
  }

  // Wait for graceful exit or force kill after timeout
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      this.logger.warn(`[ProxyManager] Timeout waiting for proxy exit. Force killing.`);
      process.kill('SIGKILL');
      resolve();
    }, 5000);

    process.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
```

### 2. State Cleanup on Error

Always clean up state when errors occur:

```typescript
catch (error) {
  // Update state to ERROR
  this._updateSessionState(session, SessionState.ERROR);
  
  // Clean up resources
  if (session.proxyManager) {
    await session.proxyManager.stop();
    session.proxyManager = undefined;
  }
  
  // Clear pending operations
  this.pendingDapRequests.clear();
  
  // Return error result
  return { success: false, error: error.message, state: session.state };
}
```

### 3. Retry with Backoff

**Example**: Init command retry pattern (`src/proxy/proxy-manager.ts`, `sendInitWithRetry`)

```typescript
private async sendInitWithRetry(initCommand: object): Promise<void> {
  const maxRetries = 5;
  const delays = [500, 1000, 2000, 4000, 8000]; // Generous backoff for Windows CI

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const timeoutMs = delays[Math.min(attempt, delays.length - 1)];

    // Send command and wait for 'init-received' event or timeout
    const received = await new Promise<boolean>((resolve, reject) => {
      // ... listen for init-received, timeout after timeoutMs
    });

    if (received) {
      this.logger.info(`Init command acknowledged on attempt ${attempt + 1}`);
      return;
    }

    // Wait before retry
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    }
  }

  throw new Error(`Failed to initialize proxy after ${maxRetries + 1} attempts`);
}
```

## Testing Error Scenarios

### 1. Testing Timeout Errors

```typescript
it('should handle initialization timeout', async () => {
  vi.useFakeTimers();
  
  try {
    const startPromise = proxyManager.start(defaultConfig);
    const expectPromise = expect(startPromise).rejects.toThrow(
      ErrorMessages.proxyInitTimeout(30)
    );
    
    await vi.advanceTimersByTimeAsync(30001);
    await expectPromise;
  } finally {
    vi.useRealTimers();
  }
});
```

### 2. Testing Error Propagation

```typescript
it('should propagate spawn errors', async () => {
  vi.mocked(mockFileSystem.pathExists).mockResolvedValue(false);
  
  await expect(proxyManager.start(defaultConfig))
    .rejects.toThrow('Bootstrap worker script not found');
});
```

### 3. Testing Error Recovery

```typescript
it('should clean up on error', async () => {
  // Simulate error during initialization
  fakeLauncher.prepareProxy((proxy) => {
    setTimeout(() => {
      proxy.simulateProcessError(new Error('Initialization failed'));
    }, 50);
  });

  await expect(proxyManager.start(defaultConfig)).rejects.toThrow('Initialization failed');
  
  // Verify cleanup
  expect(proxyManager.isRunning()).toBe(false);
  expect(proxyManager.getCurrentThreadId()).toBe(null);
});
```

## Best Practices

1. **Use Centralized Error Messages** - Use `ErrorMessages` for timeout-related errors to ensure consistency
2. **Include Context** - Add sessionId, operation name, and relevant data
3. **Log Before Throwing** - Log errors with full context before propagating
4. **Clean Up on Error** - Always release resources and reset state
5. **Provide Recovery Guidance** - Include actionable steps in error messages
6. **Test Error Paths** - Ensure all error scenarios are covered by tests
7. **Handle Async Errors** - Use try/catch with async/await consistently
8. **Set Appropriate Timeouts** - Prevent operations from hanging indefinitely

## Anti-Patterns to Avoid

### ❌ Silent Failures
```typescript
// Bad - swallowing errors
try {
  await riskyOperation();
} catch (error) {
  // Error is lost!
}
```

### ❌ Generic Error Messages
```typescript
// Bad - not helpful
throw new Error('Operation failed');
```

### ❌ Missing Cleanup
```typescript
// Bad - resource leak on error
const resource = await acquireResource();
await riskyOperation(); // If this throws, resource is leaked
await releaseResource(resource);
```

### ✅ Correct Pattern
```typescript
// Good - proper error handling
const resource = await acquireResource();
try {
  await riskyOperation();
} catch (error) {
  this.logger.error('Risk operation failed', { error, context });
  throw error; // Re-throw with original message after logging
} finally {
  await releaseResource(resource);
}
```

## Summary

The error handling pattern in MCP Debug Server ensures:
- Consistent, user-friendly error messages
- Proper error propagation and logging
- Resource cleanup and state management
- Comprehensive test coverage of error scenarios

By following these patterns, the system remains robust and provides helpful feedback when things go wrong.

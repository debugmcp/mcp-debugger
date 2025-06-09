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

All user-facing error messages are centralized in a single module:

```typescript
export const ErrorMessages = {
  dapRequestTimeout: (command: string, timeout: number) => 
    `Debug adapter did not respond to '${command}' request within ${timeout}s. ` +
    `This typically means the debug adapter has crashed or lost connection. ` +
    `Try restarting your debug session. If the problem persists, check the debug adapter logs.`,
  
  proxyInitTimeout: (timeout: number) =>
    `Debug proxy initialization did not complete within ${timeout}s. ` +
    `This may indicate that debugpy failed to start or is not installed. ` +
    `Check that Python and debugpy are properly installed and accessible.`,
  
  stepTimeout: (timeout: number) =>
    `Step operation did not complete within ${timeout}s. ` +
    `The debug adapter may have crashed or the program may be stuck. ` +
    `Try restarting your debug session.`,
  
  adapterReadyTimeout: (timeout: number) =>
    `Timed out waiting for debug adapter to be ready after ${timeout}s. ` +
    `The adapter may have failed to start properly. ` +
    `Check the debug logs for more details.`
};
```

### Benefits of Centralization

1. **Consistency** - All errors follow the same format
2. **Maintainability** - Easy to update error messages
3. **Testability** - Can verify exact error messages in tests
4. **User Experience** - Consistent troubleshooting guidance

## Error Handling Layers

### 1. Process-Level Error Handling

**Location**: `src/proxy/dap-proxy-core.ts` (lines 211-258)

```typescript
setupGlobalErrorHandlers(
  errorShutdown: () => Promise<void>,
  getCurrentSessionId: () => string | null
): void {
  // Uncaught exception handler
  process.on('uncaughtException', (error: Error) => {
    this.logger.error('[ProxyRunner] Uncaught exception:', error);
    const sessionId = getCurrentSessionId() || 'unknown';
    
    this.dependencies.messageSender.send({
      type: 'error',
      message: `Proxy uncaught exception: ${error.message}`,
      sessionId
    });

    errorShutdown().finally(() => {
      process.exit(1);
    });
  });

  // Unhandled rejection handler
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    this.logger.error('[ProxyRunner] Unhandled rejection:', { reason, promise });
    const sessionId = getCurrentSessionId() || 'unknown';
    
    this.dependencies.messageSender.send({
      type: 'error',
      message: `Proxy unhandled rejection: ${reason}`,
      sessionId
    });
  });

  // Graceful shutdown on signals
  process.on('SIGTERM', () => {
    this.logger.info('[ProxyRunner] Received SIGTERM, shutting down gracefully');
    errorShutdown().finally(() => {
      process.exit(0);
    });
  });
}
```

### 2. Component-Level Error Handling

**Example**: SessionManager error handling (`src/session/session-manager.ts`, lines 474-502)

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

**Example**: ProxyManager DAP request timeout (`src/proxy/proxy-manager.ts`, lines 283-293)

```typescript
// Timeout handler
setTimeout(() => {
  if (this.pendingDapRequests.has(requestId)) {
    this.pendingDapRequests.delete(requestId);
    reject(new Error(ErrorMessages.dapRequestTimeout(command, 35)));
  }
}, 35000);
```

**Example**: SessionManager step operation timeout (`src/session/session-manager.ts`, lines 616-643)

```typescript
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

## Error Response Patterns

### DebugResult Pattern

Most operations return a standardized `DebugResult`:

```typescript
interface DebugResult {
  success: boolean;
  state: SessionState;
  error?: string;
  data?: any;
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

**Location**: `src/session/session-manager.ts` (lines 313-344)

```typescript
private cleanupProxyEventHandlers(session: ManagedSession, proxyManager: IProxyManager): void {
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
    return; // Already stopped, no error
  }

  this.logger.info(`[ProxyManager] Stopping proxy for session ${this.sessionId}`);

  // Send terminate command
  try {
    this.sendCommand({ cmd: 'terminate' });
  } catch (error) {
    this.logger.error(`[ProxyManager] Error sending terminate command:`, error);
    // Continue with force kill
  }

  // Wait for graceful exit or force kill after timeout
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      this.logger.warn(`[ProxyManager] Timeout waiting for proxy exit. Force killing.`);
      this.proxyProcess?.kill('SIGKILL');
      resolve();
    }, 5000);

    this.proxyProcess?.once('exit', () => {
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

**Example**: Connection retry pattern

```typescript
async connectWithRetry(host: string, port: number, maxRetries = 5): Promise<IDapClient> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.connect(host, port);
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      this.logger.warn(`Connection attempt ${attempt} failed, retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Should not reach here');
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

1. **Use Centralized Error Messages** - Always use `ErrorMessages` for user-facing errors
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
  throw new Error(ErrorMessages.operationFailed(error.message));
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

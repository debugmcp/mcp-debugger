# Error Handling Guide for MCP Debugger

## Overview

The MCP Debugger uses a typed error system for specific backend and session-manager failure modes (unknown session, terminated session, proxy not running, missing runtime). Not all error paths use these typed errors; many operation-level failures return structured `DebugResult` objects with `success: false`, and some paths normalize generic errors. This guide documents the patterns and best practices for error handling.

## Error System Architecture

### Typed Error Classes

Typed debugger-domain errors extend from the MCP SDK's `McpError` class and are defined in `src/errors/debug-errors.ts`. Note that not all failures in the stack are represented as these typed errors; some paths return structured `DebugResult` failure objects or normalize generic errors:

```typescript
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export class SessionNotFoundError extends McpError {
  constructor(sessionId: string) {
    super(
      ErrorCode.InvalidParams,
      `Session not found: ${sessionId}`,
      { sessionId }
    );
  }
}
```

### Available Error Types

| Error Class | Use Case | Error Code |
|------------|----------|------------|
| `SessionNotFoundError` | Session doesn't exist | `InvalidParams` |
| `SessionTerminatedError` | Operation on terminated session | `InvalidRequest` |
| `ProxyNotRunningError` | Debug proxy not active | `InvalidRequest` | Has `sessionId` and `operation` as class properties (both stored via `this.sessionId` and `this.operation`) and also included in the MCP error payload `data` |
| `LanguageRuntimeNotFoundError` | Language runtime missing | `InvalidParams` |
| `PythonNotFoundError` | Python specifically not found | `InvalidParams` |
| `LanguageRuntimeNotFoundError` | Language runtime not found (generic) | `InvalidParams` |
| `DebugSessionCreationError` | Failed to create session | `InternalError` |
| `UnsupportedLanguageError` | Language not supported or adapter not found | `InvalidParams` |

## Implementation Patterns

### Pattern 1: Throw Typed Errors Consistently

**❌ Bad: Mixed error patterns**
```typescript
// Some methods throw
if (!session) throw new Error("Session not found");

// Some methods return error objects
return { success: false, error: "Session not found" };

// Some methods return empty data
return [];
```

**✅ Good: Consistent throwing**
```typescript
if (!session) {
  throw new SessionNotFoundError(sessionId);
}

if (session.sessionLifecycle === SessionLifecycleState.TERMINATED) {
  throw new SessionTerminatedError(sessionId);
}

if (!session.proxyManager?.isRunning()) {
  throw new ProxyNotRunningError(sessionId, 'continue');
}
```

### Pattern 2: Error Propagation

The error handling uses a mixed strategy across three layers:

1. **Implementation Layer (Backend)** - Uses typed `McpError` subclasses (e.g., `SessionNotFoundError`, `ProxyNotRunningError`) for infrastructure failures (unknown session, terminated session, proxy not running). These are defined in `src/errors/debug-errors.ts`. Operation-level failures (e.g., session not paused, missing thread ID) return structured `DebugResult` objects with `success: false` rather than throwing.
2. **Server Layer** - The MCP server (`src/server.ts`) may also throw `McpError` directly (e.g., for invalid parameters before reaching the session manager). The MCP SDK serializes all `McpError` instances into protocol-level error responses. `DebugResult` failures are returned as successful tool responses with `success: false`.
3. **Client Layer** - Receives either a protocol-level MCP error (from typed backend errors or server-level `McpError`) or a structured failure result with `success: false`, depending on which layer the failure originated in

```typescript
// Implementation (throws typed error for infrastructure failures)
async continue(sessionId: string): Promise<DebugResult> {
  const session = this.getSession(sessionId);
  if (!session) {
    throw new SessionNotFoundError(sessionId);
  }
  // ... continue logic
}

// Server (automatic serialization by MCP)
try {
  await this.sessionManager.continue(sessionId);
} catch (error) {
  // MCP framework serializes error.message automatically
  throw error;
}

// Client receives: "Session not found: test-session"
```

## Testing Patterns

### Pattern 1: Test Error Types, Not Messages

**❌ Bad: String matching (fragile)**
```typescript
await expect(operations.continue('invalid'))
  .rejects.toThrow('Session not found');
```

**✅ Good: Type checking (robust)**
```typescript
import { SessionNotFoundError } from '../src/errors/debug-errors';

await expect(operations.continue('invalid'))
  .rejects.toThrow(SessionNotFoundError);

// Or check specific properties
await expect(operations.continue('invalid'))
  .rejects.toMatchObject({
    code: ErrorCode.InvalidParams,  // import { ErrorCode } from '@modelcontextprotocol/sdk/types.js'
                                     // or import { McpErrorCode } from 'src/errors/debug-errors' for the local alias
    sessionId: 'invalid'
  });
```

### Pattern 2: Use Fake Timers for Timeout Tests

**❌ Bad: Real timeouts (slow, flaky)**
```typescript
it('should timeout', async () => {
  const promise = proxyManager.start(config);
  // Waits 30 real seconds!
  await expect(promise).rejects.toThrow('timeout');
}, 35000);
```

**✅ Good: Fake timers (fast, deterministic)**
```typescript
it('should timeout', async () => {
  vi.useFakeTimers();
  
  const promise = proxyManager.start(config);
  
  // Instantly advance time
  await vi.advanceTimersByTimeAsync(31000);
  
  await expect(promise).rejects.toThrow('timeout');
  
  vi.useRealTimers();
});
```

### Pattern 3: Separate Unit from Integration Tests

**Unit Tests** - Everything mocked, use fake timers:
```typescript
describe('ProxyManager - Unit Tests', () => {
  beforeEach(() => {
    vi.mock('../implementations/process-launcher');
    vi.useFakeTimers();
  });
  
  it('handles timeout instantly', async () => {
    // Test runs in milliseconds
  });
});
```

**Integration Tests** - Real operations, shorter timeouts:
```typescript
describe('ProxyManager - Integration', () => {
  it('handles real timeout', async () => {
    const config = { ...defaultConfig, timeoutMs: 1000 }; // 1s not 30s
    await expect(proxyManager.start(config))
      .rejects.toThrow('timeout');
  }, 2000); // 2s test timeout
});
```

## Edge Case Handling

### Data Retrieval Operations

Some operations return empty data instead of throwing errors for better UX:

```typescript
// getVariables, getStackTrace, getScopes:
// - Unknown session ID → throws SessionNotFoundError
// - Valid session but not paused, no active proxy, or DAP request fails → returns []

async getVariables(sessionId: string, ref: number): Promise<Variable[]> {
  const session = this._getSessionById(sessionId); // throws SessionNotFoundError if not found

  // Return empty array for non-critical failures
  if (!session.proxyManager?.isRunning()) {
    this.logger.warn('No active proxy');
    return [];
  }
  
  if (session.state !== SessionState.PAUSED) {
    this.logger.warn('Session not paused');
    return [];
  }
  
  try {
    // ... fetch variables
  } catch (error) {
    this.logger.error('Failed to get variables:', error);
    return []; // Graceful degradation
  }
}
```

### Control Flow Operations

Control operations throw errors for clear failure signaling:

```typescript
// continue, stepOver, stepInto, stepOut throw typed errors for infrastructure failures:
// - Session not found → SessionNotFoundError
// - Session terminated → SessionTerminatedError
// - No active proxy → ProxyNotRunningError
// For user-action preconditions (e.g., not paused, missing thread id),
// they return a failed DebugResult rather than throwing.

async continue(sessionId: string): Promise<DebugResult> {
  const session = this.getSession(sessionId);
  
  if (session.sessionLifecycle === SessionLifecycleState.TERMINATED) {
    throw new SessionTerminatedError(sessionId);
  }
  
  if (!session.proxyManager?.isRunning()) {
    throw new ProxyNotRunningError(sessionId, 'continue');
  }
  
  // ... continue logic
}
```

### Session Cleanup Operations

`closeSession()` uses soft error handling -- it returns `false` instead of throwing for not-found or already-terminated sessions. This ensures cleanup operations (including `closeAllSessions()`) are idempotent and do not propagate errors for sessions that have already been cleaned up:

```typescript
async closeSession(sessionId: string): Promise<boolean> {
  const session = this.sessionStore.get(sessionId);
  if (!session) {
    this.logger.warn(`[SESSION_CLOSE_FAIL] Session not found: ${sessionId}`);
    return false; // Soft failure, no throw
  }
  // ... cleanup logic
}
```

## Migration Guide

If you're updating existing code to use typed errors:

1. **Replace string errors with typed errors:**
   ```typescript
   // Before
   throw new Error(`Session not found: ${id}`);
   
   // After
   throw new SessionNotFoundError(id);
   ```

2. **Update test assertions:**
   ```typescript
   // Before
   expect(fn).rejects.toThrow('Session not found');
   
   // After
   expect(fn).rejects.toThrow(SessionNotFoundError);
   ```

3. **Convert timeout tests to fake timers:**
   ```typescript
   // Before
   it('times out', async () => { /* waits 30s */ }, 35000);
   
   // After
   it('times out', async () => {
     vi.useFakeTimers();
     // ... instant test
     vi.useRealTimers();
   });
   ```

## Best Practices

1. **Use typed errors** for all new error cases
2. **Test error types**, not error messages
3. **Use fake timers** for unit tests covering timer-driven logic (integration tests may use real but shortened timeouts)
4. **Separate unit tests** (mocked, fast) from integration tests (real, slower)
5. **Return empty data** for non-critical data retrieval failures
6. **Throw errors** for control flow operations that must succeed
7. **Log errors** before returning empty data for debugging
8. **Include context** in error constructors (sessionId, operation, etc.)

## Adding New Error Types

To add a new error type:

1. Define the error class in `src/errors/debug-errors.ts`:
   ```typescript
   export class MyNewError extends McpError {
     constructor(context: string) {
       super(
         ErrorCode.InvalidRequest,
         `My error message: ${context}`,
         { context }
       );
     }
   }
   ```

2. Use it in implementation:
   ```typescript
   if (badCondition) {
     throw new MyNewError(contextInfo);
   }
   ```

3. Test with type assertions:
   ```typescript
   await expect(operation())
     .rejects.toThrow(MyNewError);
   ```

## Debugging Tips

1. **Check error types in logs** - The error class name is logged
2. **Use error details** - Additional context is in the error's data property
3. **Extract messages safely** - Use `getErrorMessage()` helper to safely extract message from unknown error types

## Summary

The typed error system provides:
- **Type safety** - Catch errors at compile time
- **Consistency** - Same patterns everywhere
- **Testability** - Test behavior, not strings
- **Maintainability** - Change messages without breaking tests
- **Debuggability** - Rich error context and logging

By following these patterns, the codebase remains maintainable and tests remain reliable even as error messages evolve.

# Error Handling Guide for MCP Debugger

## Overview

The MCP Debugger uses a typed error system to provide consistent, maintainable, and testable error handling throughout the application. This guide documents the patterns and best practices for error handling.

## Error System Architecture

### Typed Error Classes

All errors extend from the MCP SDK's `McpError` class and are defined in `src/errors/debug-errors.ts`:

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
| `ProxyNotRunningError` | Debug proxy not active | `InvalidRequest` |
| `LanguageRuntimeNotFoundError` | Language runtime missing | `InvalidParams` |
| `PythonNotFoundError` | Python specifically not found | `InvalidParams` |
| `DebugSessionCreationError` | Failed to create session | `InternalError` |
| `FileValidationError` | File validation failed | `InvalidParams` |
| `PortAllocationError` | No available ports | `InternalError` |
| `UnsupportedLanguageError` | Language not supported or adapter not found | `InvalidParams` |
| `NodeNotFoundError` | Node.js runtime not found | `InvalidParams` |
| `ProxyInitializationError` | Proxy failed to initialize | `InternalError` |

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

The error handling follows a three-layer pattern:

1. **Implementation Layer** - Throws typed errors
2. **Server Layer** - Catches and serializes for MCP protocol
3. **Client Layer** - Receives readable error messages

```typescript
// Implementation (throws typed error)
async continue(sessionId: string): Promise<void> {
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
    code: McpErrorCode.InvalidParams,
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
// getVariables, getStackTrace, getScopes return [] when:
// - No active proxy
// - Session not paused
// - DAP request fails

async getVariables(sessionId: string, ref: number): Promise<Variable[]> {
  const session = this.getSession(sessionId);
  
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
// continue, stepOver, stepInto, stepOut throw when:
// - Session not found
// - Session terminated
// - No active proxy

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
3. **Use fake timers** for all timeout tests
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
3. **Check error recovery** - Use `isRecoverableError()` helper to determine if an error is transient
4. **Extract messages safely** - Use `getErrorMessage()` helper to safely extract message from unknown error types
5. **Type-guard MCP errors** - Use `isMcpError<T>()` to narrow error types in catch blocks

## Summary

The typed error system provides:
- **Type safety** - Catch errors at compile time
- **Consistency** - Same patterns everywhere
- **Testability** - Test behavior, not strings
- **Maintainability** - Change messages without breaking tests
- **Debuggability** - Rich error context and logging

By following these patterns, the codebase remains maintainable and tests remain reliable even as error messages evolve.

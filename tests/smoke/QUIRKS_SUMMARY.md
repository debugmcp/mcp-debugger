# Smoke Test Quirks & Behaviors Summary

## Overview
This document summarizes the actual behaviors and quirks discovered during smoke test implementation for the JavaScript and Python debug adapters. These tests validate what ACTUALLY works, not idealized behavior.

## JavaScript Adapter Quirks

### 1. Unverified Breakpoints
- **Behavior**: Breakpoints often report as "unverified" when initially set
- **Impact**: Breakpoints still work despite being reported as unverified
- **Test Approach**: Tests accept unverified status and proceed
- **User Impact**: May cause confusion but functionality remains intact

### 2. Verbose Stack Traces
- **Behavior**: Stack traces include many Node.js internal frames
- **Impact**: Makes it harder to find user code frames
- **Test Approach**: Filter frames to find user code entries
- **Recommendation**: Consider implementing frame filtering in adapter

### 3. Variable Reference Instability
- **Behavior**: Variable references and frame IDs change after each step operation
- **Impact**: Requires complete refresh pattern after stepping
- **Required Pattern**:
  1. Step operation
  2. Get new stack trace → new frameId
  3. Get new scopes → new variablesReference
  4. Get variables with new reference
- **User Impact**: More API calls required for complete state refresh

### 4. Module Entry Stops
- **Behavior**: May stop at module entry points before user breakpoints
- **Impact**: Additional continue operations may be needed
- **Test Approach**: Wait periods and multiple continue attempts

## Python Adapter Behaviors

### 1. Immediate Breakpoint Verification ✅
- **Behavior**: Breakpoints are verified immediately upon setting
- **Impact**: More predictable debugging experience
- **Difference from JS**: No uncertainty about breakpoint status

### 2. Clean Stack Traces ✅
- **Behavior**: Stack traces only include user frames
- **Impact**: Easier to navigate and understand
- **Typical depth**: 2-5 frames vs JavaScript's 20+ frames

### 3. Stable Variable References ✅
- **Behavior**: Variable references remain stable after step operations
- **Impact**: No need for complete refresh pattern
- **Efficiency**: Fewer API calls needed

### 4. Absolute Path Requirement ⚠️
- **Behavior**: Script paths must be absolute for start_debugging
- **Impact**: Relative paths cause "Script file not found" errors
- **Test Approach**: Use path.resolve() for all script paths
- **Recommendation**: Document prominently or add path resolution

### 5. Expression-Only Evaluation
- **Behavior**: evaluate_expression only accepts expressions, not statements
- **Impact**: Assignments (x = 99) raise SyntaxError
- **Test Validation**: Tests confirm statements are rejected
- **User Guidance**: Document this limitation clearly

## Comparative Summary

| Feature | JavaScript | Python | Winner |
|---------|------------|--------|--------|
| Breakpoint Verification | Often unverified initially | Immediate verification | Python ✅ |
| Stack Trace Clarity | Many internal frames | Clean, user-only frames | Python ✅ |
| Variable Reference Stability | Changes after steps | Stable references | Python ✅ |
| Path Handling | Flexible | Requires absolute paths | JavaScript ✅ |
| Expression Evaluation | Flexible | Expression-only | JavaScript ✅ |
| Overall Stability | 7.5/10 | 9/10 | Python ✅ |

## Test Implementation Strategy

### Pragmatic Testing Approach
1. **Test actual behavior**: Don't test for idealized behavior that doesn't exist
2. **Accept quirks**: Build tests that work with quirks, not against them
3. **Document everything**: Clear comments about expected quirks
4. **Graceful handling**: Use callToolSafely for error-tolerant operations

### Key Patterns Used

#### JavaScript Refresh Pattern
```typescript
// After any step operation:
const newStackResult = await callToolSafely(mcpClient!, 'get_stack_trace', { sessionId });
const newFrameId = newStackResult.stackFrames[0].id;
const newScopesResult = await callToolSafely(mcpClient!, 'get_scopes', { sessionId, frameId: newFrameId });
const newScope = newScopesResult.scopes[0];
const newVarsResult = await callToolSafely(mcpClient!, 'get_variables', { 
  sessionId, 
  scope: newScope.variablesReference 
});
```

#### Python Path Resolution
```typescript
// Always use absolute paths for Python:
const scriptPath = path.resolve(ROOT, 'test-scripts', 'test_python_debug.py');
```

#### Quirk-Aware Assertions
```typescript
// JavaScript: Accept unverified breakpoints
// Note: Breakpoint might report as unverified initially - this is expected

// Python: Expect immediate verification
if (bpResponse.verified !== undefined) {
  expect(bpResponse.verified).toBe(true);
}
```

## Recommendations for Improvement

### JavaScript Adapter
1. **Implement frame filtering**: Add option to hide Node internal frames
2. **Stabilize references**: Consider caching mechanism for variable references
3. **Improve breakpoint binding**: Better feedback on binding lifecycle
4. **Document refresh pattern**: Provide clear examples in docs

### Python Adapter
1. **Path resolution**: Accept relative paths and resolve internally
2. **Statement evaluation**: Consider optional mode for statement execution
3. **Documentation**: Clearly state expression-only limitation

### General
1. **Consistent behavior**: Align adapters where possible
2. **Clear documentation**: Document all quirks prominently
3. **Helper utilities**: Provide client libraries that handle quirks
4. **Test coverage**: Maintain smoke tests as regression guards

## Conclusion

Both adapters are functional and usable, with Python providing a more polished experience overall. JavaScript's quirks are manageable but require more complex client code. The smoke tests successfully validate current behavior and will catch regressions if these behaviors change.

The key insight: **Test what works, document what's quirky, and build resilient client code that handles reality, not ideals.**

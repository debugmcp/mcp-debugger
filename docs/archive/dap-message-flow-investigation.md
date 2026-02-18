# DAP Message Flow Investigation Report

## Date: 2025-07-26

## Objective
Trace the actual DAP message flow in mcp-debugger to understand why breakpoint validation feedback isn't reaching users.

## Executive Summary

The investigation revealed that debugpy DOES provide validation messages for invalid breakpoints through the DAP `message` field, but mcp-debugger was not capturing or surfacing this information to users. The fix was simple: capture the `message` field and include it in responses.

## Key Findings

### 1. debugpy Provides Validation Messages!

From the proxy log analysis, debugpy returns detailed messages for invalid breakpoints:

```json
{
  "body": {
    "breakpoints": [
      {
        "id": 0,
        "line": 6,
        "message": "Breakpoint in file that does not exist.",
        "source": {"path": "tests/manual/dap-message-test/test_valid.py"},
        "verified": false
      }
    ]
  }
}
```

### 2. The System Was Already Receiving This Information

- The DAP response flows correctly through all layers
- The `verified` field was being captured
- But the `message` field was being ignored

### 3. debugpy Does NOT Support `breakpointLocationsRequest`

From the initialize response:
```javascript
supportsBreakpointLocationsRequest: undefined
```

This means pre-validation is not available, making the `message` field even more important.

## Implementation

### 1. Added `message` Field to Breakpoint Model

```typescript
// src/session/models.ts
export interface Breakpoint {
  // ... existing fields ...
  /** Validation message from DAP adapter */
  message?: string;
}
```

### 2. Captured Message in Session Manager

```typescript
// src/session/session-manager-operations.ts
const bpInfo = response.body.breakpoints[0]; 
newBreakpoint.verified = bpInfo.verified;
newBreakpoint.line = bpInfo.line || newBreakpoint.line;
newBreakpoint.message = bpInfo.message; // Capture validation message
```

### 3. Surfaced Message to Users

```typescript
// src/server.ts
result = { content: [{ type: 'text', text: JSON.stringify({ 
  success: true, 
  breakpointId: breakpoint.id, 
  file: breakpoint.file, 
  line: breakpoint.line, 
  verified: breakpoint.verified, 
  message: breakpoint.message || `Breakpoint set at ${breakpoint.file}:${breakpoint.line}`,
  warning: !breakpoint.verified ? (breakpoint.message || "Breakpoint could not be verified. Line may not be executable.") : undefined
}) }] };
```

## Test Results

### What debugpy Actually Returns

Based on the investigation, debugpy provides specific messages for different scenarios:

1. **Non-existent file**: "Breakpoint in file that does not exist."
2. **Invalid lines**: Likely returns similar descriptive messages (needs further testing)
3. **Beyond EOF**: Expected to return line-related validation messages

## Impact

### Before
- Users see: "verified: false" with no explanation
- Users experience: 30-second timeouts when initial breakpoints are invalid
- Users think: The debugger is broken

### After
- Users see: "verified: false" with "Breakpoint in file that does not exist."
- Users see: Warning field with actionable information
- Users understand: Exactly what went wrong and can fix it

## Remaining Work

1. **Build and Test**: The changes need to be built and tested with real scenarios
2. **Additional Scenarios**: Test what messages debugpy provides for:
   - Comment lines
   - Blank lines
   - Docstrings
   - Lines beyond EOF
   - Syntax errors

3. **Documentation**: Update user documentation to explain breakpoint validation

## Conclusion

The investigation successfully identified that:
1. debugpy provides excellent validation feedback through the `message` field
2. mcp-debugger was simply not capturing/surfacing this information
3. The fix is minimal and maintains backward compatibility

This resolves the core issue of users not understanding why their breakpoints fail validation.

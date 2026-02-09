# SSE JavaScript Debugging Fix Summary

## Issue Description
JavaScript debugging in SSE mode failed to retrieve stack traces, while STDIO mode worked correctly. The SSE smoke tests passed, but production usage failed.

## Root Cause
The issue was a **timing window** between:
1. Child session creation completing
2. Child session being marked as active (`activeChild` being set)

In SSE mode, the `stackTrace` request was hitting during this window, before the child was marked active, causing it to fall back to the parent session which returned empty results.

## Why the Smoke Test Passed
The SSE smoke test **polls repeatedly** for the stack trace (up to 2.5 seconds with 150ms intervals), giving the child session time to become active. Production code makes a single request that fails if the child isn't ready.

## The Fix

### 1. Added Instrumentation (src/proxy/child-session-manager.ts)
```typescript
logger.info(`[ChildSessionManager:${this.instanceId}] *** ACTIVE CHILD SET *** for ${pendingId} at timestamp ${Date.now()}`);
```

### 2. Fixed Wait Logic (src/proxy/minimal-dap.ts)
```typescript
// For js-debug, we know a child is expected after launch, so poll regardless of flags
const isJsDebug = this.policy?.name === 'js-debug';
if (command === 'stackTrace' && !this.activeChild) {
  // For js-debug, always poll briefly for child even if flags say no child yet
  // This handles the timing window where child exists but isn't marked active
  if (isJsDebug || adoptionInProgress || hasActiveChild) {
    // Poll for up to 5 seconds for the child to become active
    for (let i = 0; i < maxIterations && !this.activeChild; i++) {
      await this.sleep(pollIntervalMs);
      this.activeChild = manager?.getActiveChild() || null;
    }
  }
}
```

### Key Changes:
1. **Policy-aware waiting**: Check if `policy.name === 'js-debug'`
2. **Always poll for js-debug**: Even when flags indicate no child yet
3. **Frequent polling**: 50ms intervals for faster response
4. **Extended timeout**: 5 seconds to handle slow systems

## Test Results
✅ Stack trace retrieved with 4 frames
✅ Local variables retrieved successfully (a=1, b=2)
✅ Both SSE and STDIO modes now work correctly

## Files Modified
- `src/proxy/minimal-dap.ts` - Added policy-aware polling logic
- `src/proxy/child-session-manager.ts` - Enhanced logging for child activation

## Test Script
Created `test-sse-js-debug-fix.mjs` which:
1. Starts SSE server
2. Creates JavaScript debug session
3. Sets breakpoint and starts debugging
4. Immediately requests stack trace (where the bug occurred)
5. Verifies frames are returned

## Conclusion
The fix ensures that `stackTrace` requests for JavaScript debugging wait for the child session to be fully active before proceeding, eliminating the timing window that caused SSE mode to fail while STDIO worked.

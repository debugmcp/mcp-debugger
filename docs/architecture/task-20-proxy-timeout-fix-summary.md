# Task 20: Proxy Script Path Validation Timeout Fix

## Summary
Fixed an issue where proxy initialization errors (specifically script path validation failures) were causing 30-second timeouts instead of failing quickly. The root cause was that the proxy worker process wasn't properly terminating after encountering critical errors during initialization.

## Issue Description
When starting a debug session with a non-existent script path, the proxy manager would hang for 30 seconds before timing out, rather than failing immediately with a meaningful error message.

## Root Cause
The `dap-proxy-worker.ts` was sending error messages but not terminating the process, causing the ProxyManager to wait for the full initialization timeout (30 seconds).

## Solution
Added `process.exit(1)` calls in the proxy worker after critical initialization errors:

1. **Script path validation failure**: When the script path doesn't exist, the worker now:
   - Sends the error message to the parent process
   - Shuts down cleanly
   - Exits with code 1

2. **Other initialization errors**: Any caught errors in the init handler now also trigger process exit

## Changes Made

### `src/proxy/dap-proxy-worker.ts`
```typescript
// Script validation failure
if (!scriptExists) {
  const errorMsg = `Script path not found: ${payload.scriptPath}`;
  this.logger.error(`[Worker] ${errorMsg}`);
  this.sendError(errorMsg);
  await this.shutdown();
  process.exit(1);  // Added this to ensure immediate termination
}

// General initialization error handling
} catch (error) {
  this.state = ProxyState.UNINITIALIZED;
  const message = error instanceof Error ? error.message : String(error);
  this.logger?.error(`[Worker] Critical initialization error: ${message}`, error);
  await this.shutdown();
  process.exit(1);  // Added this to ensure immediate termination
}
```

### Test Updates
Created comprehensive integration tests in `tests/core/integration/proxy-error-handling.test.ts` to verify:
- Script path validation errors fail quickly (< 1 second, not 30 seconds)
- Error messages are properly propagated
- Container mode path handling works correctly
- Various initialization errors don't cause timeouts

## Impact
- **Performance**: Initialization errors now fail immediately instead of after 30 seconds
- **User Experience**: Users get instant feedback when script paths are invalid
- **Error Messages**: Clear, descriptive error messages are shown immediately

## Verification
All tests pass, confirming:
- Script path validation errors fail in under 1 second
- Error messages are correctly propagated from worker to manager
- No 30-second timeouts occur for initialization errors

## Related Files
- `src/proxy/dap-proxy-worker.ts` - Added process.exit calls
- `tests/core/integration/proxy-error-handling.test.ts` - New integration tests
- `src/proxy/proxy-manager.ts` - No changes needed (already handles process exit)

## Lessons Learned
When implementing worker processes that communicate via IPC:
1. Always ensure critical errors lead to process termination
2. Don't rely solely on error messages - the parent process needs the exit signal
3. Test timeout behavior explicitly to catch hanging scenarios early

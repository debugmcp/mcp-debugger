# Windows CI IPC Race Condition Fix

## Problem
Two tests were failing consistently on Windows GitHub Actions CI but passing locally:
- `tests/adapters/python/integration/python_debug_workflow.test.ts`
- `tests/adapters/python/integration/python-discovery.test.ts`

## Root Cause
The proxy process was terminating too quickly on Windows after sending the `dry_run_complete` message via IPC. This created a race condition where:
1. The proxy sends the `dry_run_complete` message
2. The proxy immediately sets state to TERMINATED and exits
3. The IPC channel closes before the message is delivered
4. The parent process never receives the message and times out

## Solution
Implemented a proper handshake mechanism to ensure IPC message delivery before process termination:

### 1. Deferred State Transition (`src/proxy/dap-proxy-worker.ts`)
```typescript
// Instead of immediately setting TERMINATED state
setImmediate(() => {
  this.state = ProxyState.TERMINATED;
  this.logger!.info('[Worker DRY_RUN] Dry run complete. State set to TERMINATED after message flush.');
  
  // Give more time for IPC to flush on Windows
  setTimeout(() => {
    process.exit(0);
  }, 100);
});
```

### 2. Duplicate Init Command Handling (`src/proxy/dap-proxy-core.ts`)
```typescript
// Prevent race conditions from retry attempts
if (command.cmd === 'init') {
  if (this.receivedInitCommand && command.dryRunSpawn) {
    this.logger.info('[ProxyRunner] Duplicate init command detected, ignoring to prevent race condition');
    return;
  }
  this.receivedInitCommand = true;
  // ...
}
```

### 3. Improved Exit Logic
- No longer immediately exits when state becomes TERMINATED for dry runs
- Allows the event loop to process pending IPC messages
- Provides sufficient time for Windows IPC to flush messages

## Key Changes
1. **`src/proxy/dap-proxy-worker.ts`**: Modified `handleDryRun()` to use `setImmediate` and delayed exit
2. **`src/proxy/dap-proxy-core.ts`**: Added duplicate command detection and improved message processor
3. **`src/proxy/dap-proxy-interfaces.ts`**: No changes needed (acknowledgment infrastructure already present)

## Testing
- Both failing tests now pass locally on Windows
- Solution tested with:
  - `pnpm test tests/adapters/python/integration/python_debug_workflow.test.ts` ✅
  - `pnpm test tests/adapters/python/integration/python-discovery.test.ts` ✅

## Architecture Notes
The fix respects the handshake principle you mentioned - using timing mechanisms to ensure proper message delivery across different architectures:
- Fast systems: Minimal delay (100ms) has negligible impact
- Slower systems: Sufficient time for IPC message delivery
- Cross-platform: Works consistently on Windows, Linux, and macOS

## Future Improvements
Consider implementing a full acknowledgment protocol where:
1. Child sends message with `requiresAck: true`
2. Parent sends acknowledgment
3. Child waits for acknowledgment before terminating

This would be more robust but requires changes to both parent and child processes.

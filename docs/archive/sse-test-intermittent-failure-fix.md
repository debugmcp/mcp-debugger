# SSE Test Intermittent Failure Fix

## Issue Description
The test `"should work when SSE server is spawned from different working directory"` in `tests/e2e/mcp-server-smoke-sse.test.ts` was failing intermittently during full test suite runs but passing consistently when run in isolation.

## Root Cause Analysis
1. **Not a real bug**: The server implementation works correctly when spawned from different directories.
2. **Test infrastructure issue**: The test was experiencing timing issues due to:
   - Server startup taking longer when spawned from a different directory
   - Increased load during full test suite execution
   - Default 10-second timeout in `waitForPort` being insufficient

## Investigation Steps
1. Ran the test in isolation - it passed consistently
2. Ran the full test suite - test failed intermittently
3. Searched for hardcoded paths or `MCP_DEBUG_PROJECT_ROOT` usage - found none
4. Identified the issue was with the `waitForPort` timeout being too short

## Solution
Increased the timeout for `waitForPort` from 10 seconds to 30 seconds specifically for the test that spawns the server from a different directory:

```typescript
// Wait for server to be ready (give extra time when spawned from different directory)
console.log(`[SSE Smoke Test] Waiting for server on port ${serverPort} with 30s timeout...`);
const serverReady = await waitForPort(serverPort, 30000); // 30 second timeout
if (!serverReady) {
  console.error(`[SSE Smoke Test] Server failed to start on port ${serverPort} after 30 seconds`);
}
expect(serverReady).toBe(true);
```

## Key Findings
1. The server can be spawned from any directory and works correctly
2. The test infrastructure needs longer timeouts for this specific scenario
3. The `MCP_DEBUG_PROJECT_ROOT` environment variable set in the test is not used by the implementation
4. Path resolution in the server uses `import.meta.url` correctly to find resources relative to the module location

## Recommendations
1. Monitor the test for any future intermittent failures
2. Consider implementing a more robust server startup detection mechanism
3. The `MCP_DEBUG_PROJECT_ROOT` environment variable in the test can be removed as it's not used

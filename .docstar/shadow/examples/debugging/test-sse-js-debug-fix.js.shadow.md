# examples/debugging/test-sse-js-debug-fix.js
@source-hash: 8ab6dff3fc98d3eb
@generated: 2026-02-10T00:41:45Z

## Purpose
Integration test script for validating the fix to a timing bug in SSE (Server-Sent Events) JavaScript debugging where `stackTrace` was called before the child debugging session was fully active.

## Key Components

### Main Test Function - `runTest()` (L36-201)
- **Primary Orchestrator**: Manages complete test lifecycle from server startup to cleanup
- **Phases**: Server startup → Client connection → Debug session creation → Critical timing test → Cleanup
- **Error Handling**: Comprehensive try-catch with guaranteed cleanup in finally block

### Port Availability Utility - `waitForPort()` (L15-34)
- **Purpose**: Waits for SSE server to become available on specified port
- **Parameters**: `port`, `maxAttempts` (default 30)
- **Strategy**: Uses TCP connection attempts with 1-second intervals
- **Returns**: Boolean success or throws error after max attempts

## Test Flow Architecture

### 1. Server Lifecycle (L44-66)
- Spawns SSE server process using `child_process.spawn` (L45-53)
- **Server Path**: `dist/index.js` with SSE mode and debug logging
- **Port**: Fixed at 3100 for consistent testing
- Captures stdout/stderr for debugging visibility

### 2. MCP Client Setup (L69-78)
- Creates MCP client with SSEClientTransport
- **Transport URL**: `http://localhost:${PORT}/sse`
- **Client Identity**: 'test-sse-js-debug-fix' v1.0.0

### 3. Critical Timing Test Sequence (L81-167)
- **Debug Session Creation** (L82-97): Creates JavaScript debug session via MCP tool call
- **Breakpoint Setup** (L100-111): Sets breakpoint at line 11 in target script
- **Debug Start** (L114-123): Initiates debugging session
- **CRITICAL TEST** (L125-167): Immediately calls `get_stack_trace` - this is where the original timing bug occurred
- **Validation**: Checks for non-empty stackFrames array to confirm fix
- **Additional Test** (L147-162): Also tests `get_local_variables` to ensure full session readiness

## Dependencies
- **@modelcontextprotocol/sdk**: Client and SSEClientTransport for MCP communication
- **child_process**: For spawning SSE server subprocess
- **net**: For port availability checking
- **path**: For file path resolution

## Key Constants
- **PORT**: 3100 (L13) - Fixed test port
- **Target Script**: `examples/javascript/simple_test.js` (L100)
- **Breakpoint Line**: 11 (L108)

## Error Scenarios
- Server startup failure or port unavailability
- MCP client connection failure  
- Debug session creation failure
- Empty stack trace (indicates timing bug still exists)
- Tool call failures during debugging operations

## Cleanup Strategy
- Guaranteed cleanup in finally block (L182-200)
- Graceful client closure with error suppression
- Server process termination (SIGTERM → SIGKILL fallback)
- 1-second grace period for clean shutdown
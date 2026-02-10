# examples/debugging/test-sse-js-debug-fix.js
@source-hash: 8ab6dff3fc98d3eb
@generated: 2026-02-09T18:14:58Z

## Purpose
Test script that validates a specific SSE JavaScript debugging fix for timing issues where `stackTrace` was called before the child debug session was fully active. This is an end-to-end integration test that spawns an SSE server, connects an MCP client, creates a JavaScript debug session, and immediately calls stack trace operations to verify the fix.

## Key Components

### Port Configuration
- `PORT = 3100` (L13): Fixed port for testing to avoid conflicts

### Core Functions

#### `waitForPort(port, maxAttempts = 30)` (L15-34)
Polls for server readiness by attempting TCP connections. Uses exponential backoff with 1-second delays between attempts. Critical for ensuring server is ready before client connection attempts.

#### `runTest()` (L36-201)
Main test orchestrator that:
- Spawns SSE server process (L45-53) with debug logging
- Establishes MCP client connection via SSE transport (L70-78)
- Creates JavaScript debug session (L81-97)
- Sets breakpoint at line 11 of target script (L99-111)
- Starts debugging session (L114-123)
- **Critical test**: Immediately calls `get_stack_trace` (L125-139) - this is where the original timing bug occurred
- Validates stack frames are returned (L142-167)
- Optionally tests local variables retrieval (L147-161)
- Performs cleanup of debug session and resources (L169-200)

## Dependencies
- `@modelcontextprotocol/sdk/client/index.js`: MCP Client
- `@modelcontextprotocol/sdk/client/sse.js`: SSE transport
- `child_process.spawn`: Server process management
- `net`: TCP port polling

## Test Flow
1. Server startup with process monitoring (stdout/stderr capture)
2. Port availability polling
3. MCP client connection via SSE
4. Debug session lifecycle (create → set breakpoint → start → immediate stack trace)
5. Result validation and cleanup

## Critical Test Case
Lines 125-139 represent the core bug reproduction scenario. The test immediately calls `get_stack_trace` after starting debugging to verify the timing fix prevents the "child session not active" error.

## Error Handling
- Comprehensive try/catch with process.exit(1) on failures
- Graceful cleanup in finally block (L182-200)
- Server process termination with SIGTERM/SIGKILL fallback
- Client connection cleanup with error suppression

## Success Criteria
Test passes if stack frames are returned (L142-144), indicating the timing issue has been resolved and the child debug session is properly synchronized.
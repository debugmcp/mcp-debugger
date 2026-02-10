# tests/stress/cross-transport-parity.test.ts
@source-hash: 6c9e2869fe8bf7dd
@generated: 2026-02-10T00:42:05Z

## Primary Purpose
Cross-transport integration test that validates debug operations produce identical results across different MCP transport protocols (STDIO, SSE). Ensures transport layer doesn't affect debug functionality behavior or data integrity.

## Key Interfaces & Types

**DebugSequenceResult (L24-34)**: Captures complete debug session state including session creation status, breakpoint configuration, execution state, stack frame data, variable information, and error collection.

**TransportTestResult (L36-41)**: Wraps test execution results per transport with success status, debug sequence results, and error information.

## Core Class: TransportTester (L43-314)

**Server Management (L47-95)**:
- `setupSSETransport(port)` (L47-84): Spawns SSE server process, implements health check polling with 15s timeout
- `teardownSSE()` (L86-95): Graceful shutdown with SIGTERM fallback to SIGKILL

**Debug Sequence Orchestration (L97-220)**:
- `runDebugSequence(client)` (L97-220): Executes complete debug workflow:
  1. Creates debug session with JavaScript language config
  2. Sets breakpoint on `simple_test.js:11`
  3. Starts debugging with script execution
  4. Retrieves stack trace and local variables after 2s delay
  5. Closes session and cleans up resources

**Transport Testing Methods**:
- `testStdioTransport()` (L222-268): Creates STDIO client transport, executes debug sequence
- `testSSETransport()` (L270-301): Sets up SSE server, creates SSE client transport, executes debug sequence
- `parseToolResponse(response)` (L303-313): Extracts JSON from MCP tool response format

## Test Structure (L316-383)

**Environment Control**: Uses `RUN_STRESS_TESTS` environment variable to conditionally skip tests (L18-19).

**Main Test Case (L327-382)**: 
- Executes debug sequences on both STDIO and SSE transports
- Validates all transports succeed
- Performs parity comparison ensuring:
  - Boolean flags (session creation, breakpoint setting, debug start) match exactly
  - Stack frame counts differ by at most 1 frame
  - Variable counts match exactly
  - Both transports report >0 stack frames

## Dependencies
- **MCP SDK**: Client, SSEClientTransport, StdioClientTransport for protocol implementation
- **Node.js**: child_process for server spawning, fs/promises for file validation
- **Vitest**: Test framework with 60s timeout configuration

## Key Assumptions
- Test script exists at `examples/javascript/simple_test.js`
- Debug server binary available at `dist/index.js`
- SSE server provides `/health` endpoint for readiness checks
- Breakpoint at line 11 of test script is meaningful
- Debug session hits breakpoint within 2 seconds

## Architectural Patterns
- **Transport Abstraction**: Tests debug functionality independent of transport mechanism
- **Result Normalization**: Standardizes debug data for cross-transport comparison
- **Resource Management**: Explicit cleanup for spawned processes and client connections
- **Fault Tolerance**: Error collection without test abortion, graceful server shutdown
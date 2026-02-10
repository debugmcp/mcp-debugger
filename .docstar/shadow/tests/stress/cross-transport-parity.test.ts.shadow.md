# tests/stress/cross-transport-parity.test.ts
@source-hash: d4430b9ff56b6350
@generated: 2026-02-10T21:25:36Z

## Cross-Transport Debug Parity Test

Stress test module that validates identical debug operations across different MCP transport layers (STDIO, SSE, Docker). Conditionally runs based on `RUN_STRESS_TESTS` environment variable (L18-19).

### Core Interfaces

**DebugSequenceResult (L24-34)**: Captures debug session state including session creation, breakpoints, stack frames, variables, and errors.

**TransportTestResult (L36-41)**: Wraps transport type, success status, debug results, and error information.

### TransportTester Class (L43-314)

Primary orchestrator for cross-transport validation with lifecycle management:

**SSE Transport Management**:
- `setupSSETransport()` (L47-84): Spawns SSE server process, polls health endpoint for readiness
- `teardownSSE()` (L86-95): Graceful shutdown with SIGTERM/SIGKILL fallback

**Debug Sequence Execution**:
- `runDebugSequence()` (L97-220): Core test flow executing 6 debug operations:
  1. Create debug session with JavaScript language
  2. Set breakpoint on `examples/javascript/simple_test.js:11`
  3. Start debugging with script execution
  4. Retrieve stack trace after 2-second delay
  5. Get local variables from current frame
  6. Clean up session

**Transport Testing**:
- `testStdioTransport()` (L222-268): Tests via StdioClientTransport with spawned server process
- `testSSETransport()` (L270-301): Tests via SSEClientTransport on random port (4500-4999)
- `parseToolResponse()` (L303-313): Extracts JSON from MCP tool response format

### Test Suite (L316-383)

Single comprehensive test that:
1. Executes debug sequence on both STDIO and SSE transports
2. Validates all transports succeed
3. Compares key metrics for parity (session state, stack frame counts, variable counts)
4. Allows ±1 difference in stack frame counts for minor transport variations
5. Provides detailed console output for debugging

### Dependencies

- **MCP SDK**: Client, SSEClientTransport, StdioClientTransport for protocol implementation
- **Node.js**: child_process for server spawning, fs/promises for file validation
- **Vitest**: Test framework with conditional execution support

### Critical Constraints

- Test script dependency: `examples/javascript/simple_test.js` must exist (L128-134)
- 60-second timeout for complex debug operations (L21)
- Health check polling for SSE server readiness (L65-76)
- Breakpoint hardcoded to line 11 of test script (L142)
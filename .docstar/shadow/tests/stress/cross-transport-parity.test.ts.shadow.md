# tests/stress/cross-transport-parity.test.ts
@source-hash: 6c9e2869fe8bf7dd
@generated: 2026-02-09T18:15:16Z

## Purpose
Stress test that validates debugging functionality produces identical results across different MCP transport mechanisms (STDIO and SSE). Part of the test suite ensuring transport-agnostic behavior of the debug MCP server.

## Key Components

### Test Configuration (L18-22)
- `runStressTests`: Environment flag controlling test execution
- `describeStress`: Conditional test runner that skips when stress tests disabled
- `TEST_TIMEOUT`: 60-second timeout for long-running operations
- `PROJECT_ROOT`: Base directory for spawning server processes

### Data Structures (L24-41)
- `DebugSequenceResult`: Captures complete debug session metrics including session creation, breakpoint status, stack frame/variable counts, and errors
- `TransportTestResult`: Wraps transport-specific test outcomes with success status and error details

### TransportTester Class (L43-314)
Core test orchestrator handling multiple transport types:

#### SSE Transport Management (L47-95)
- `setupSSETransport()`: Spawns SSE server process, polls health endpoint for readiness
- `teardownSSE()`: Graceful shutdown with SIGTERM/SIGKILL fallback
- Uses random ports (4500-5000 range) to avoid conflicts

#### Debug Sequence Execution (L97-220)
- `runDebugSequence()`: Performs standardized debug workflow across transports
- Creates session → Sets breakpoint → Starts debugging → Retrieves stack/variables → Cleanup
- Uses `examples/javascript/simple_test.js` as test target (line 11 breakpoint)
- Includes 2-second delay for breakpoint hit detection
- Comprehensive error tracking throughout sequence

#### Transport-Specific Tests (L222-301)
- `testStdioTransport()`: Creates STDIO client with subprocess server
- `testSSETransport()`: Sets up SSE server and connects via HTTP transport
- Both methods wrap `runDebugSequence()` with transport-specific setup/teardown

#### Response Parsing (L303-313)
- `parseToolResponse()`: Extracts JSON from MCP tool response format
- Handles malformed responses gracefully

### Test Suite (L316-382)
- Single test case comparing STDIO vs SSE transport results
- Validates all operations succeed on both transports
- Performs parity checks on key metrics (session creation, breakpoints, stack frames, variables)
- Allows ±1 difference in stack frame counts for minor transport variations
- Comprehensive result logging for debugging test failures

## Dependencies
- **MCP SDK**: Client and transport implementations for both STDIO and SSE
- **Vitest**: Test framework with async support and timeouts
- **Node.js**: Child process spawning, filesystem access, path handling
- **Server Binary**: Expects compiled server at `dist/index.js` with SSE/STDIO modes

## Critical Constraints
- Requires `RUN_STRESS_TESTS=true` environment variable to execute
- Dependent on `examples/javascript/simple_test.js` existing with debuggable content at line 11
- SSE transport requires successful health check before proceeding
- All debug operations must complete within 60-second timeout
- Stack frame counts must be within ±1 between transports for parity validation
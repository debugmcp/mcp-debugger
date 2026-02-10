# tests/stress/
@generated: 2026-02-09T18:16:11Z

## Purpose
The `tests/stress` directory contains comprehensive stress testing infrastructure for validating the reliability and parity of MCP (Model Context Protocol) transport mechanisms. This module ensures the debug MCP server maintains consistent behavior and performance under extreme conditions across different transport protocols (STDIO and SSE).

## Key Components and Organization

### Transport Parity Validation (`cross-transport-parity.test.ts`)
Core component that validates functional equivalence between transport mechanisms:
- **TransportTester Class**: Orchestrates debug workflows across STDIO and SSE transports
- **DebugSequenceResult/TransportTestResult**: Data structures capturing comprehensive debug session metrics
- **Standardized Debug Workflow**: Creates sessions, sets breakpoints, retrieves stack frames/variables, performs cleanup
- **Parity Validation**: Ensures identical debugging results (±1 tolerance for stack frames) across transports

### Transport Reliability Testing (`sse-stress.test.ts`)
Specialized stress testing for SSE transport under extreme conditions:
- **SSEStressTester Class**: Manages server processes and concurrent client connections
- **TestMetrics Interface**: Tracks connection statistics, timing, memory usage, and error patterns
- **Multi-scenario Testing**: Rapid connect/disconnect cycles, burst connections, long-running sessions, server recovery

## Public API Surface

### Main Entry Points
- **Environment Control**: Both test files use `RUN_STRESS_TESTS` environment variable to conditionally execute
- **Test Orchestrators**: 
  - `TransportTester` for cross-transport validation
  - `SSEStressTester` for SSE-specific stress testing
- **Configurable Timeouts**: 60s for parity tests, 2min for stress tests

### Test Scenarios
1. **Cross-Transport Parity**: Validates STDIO vs SSE produce identical debug results
2. **Rapid Connection Cycling**: 20 cycles × 3 connections testing connection reliability
3. **Burst Connection Handling**: 10 simultaneous connections under load
4. **Long-Running Session Stability**: 15-second sustained connections with periodic operations
5. **Server Recovery**: Crash simulation and restart validation

## Internal Organization and Data Flow

### Server Management Pattern
Both test files implement similar server lifecycle patterns:
1. **Dynamic Port Allocation**: Prevents conflicts in parallel execution
2. **Health Check Polling**: Ensures server readiness before testing
3. **Graceful Shutdown**: SIGTERM followed by SIGKILL fallback
4. **Process Isolation**: Each test spawns independent server instances

### Resource Management Strategy
- **Memory Leak Detection**: Heap usage monitoring with growth thresholds
- **Connection Pool Management**: Batch operations with Promise.allSettled for fault tolerance
- **Error Collection**: Non-failing error accumulation for comprehensive reporting
- **Cleanup Orchestration**: afterEach hooks ensure resource deallocation

### Metrics Collection
- **Performance Tracking**: Connection timing, success rates, memory usage
- **Functional Validation**: Debug session creation, breakpoint status, stack frame counts
- **Error Analysis**: Comprehensive error capture without test abortion

## Important Patterns and Conventions

### Conditional Execution
All stress tests are gated behind `RUN_STRESS_TESTS=true` to prevent CI/CD impact while allowing comprehensive local testing.

### Fault Tolerance
Tests use Promise.allSettled patterns and error-tolerant disconnection to handle partial failures gracefully, focusing on overall system behavior rather than individual operation success.

### Standardized Test Target
Uses `examples/javascript/simple_test.js` with line 11 breakpoint as consistent debug target across all transport validation.

### Performance Benchmarks
- 90% success rate for rapid connection cycles
- <50MB memory growth for connection cycling
- <1s average connection time
- 80% success rate for burst connections
- <20MB memory growth for long-running sessions

This directory serves as the reliability assurance layer for MCP transport implementations, ensuring production readiness through systematic stress testing and cross-transport validation.
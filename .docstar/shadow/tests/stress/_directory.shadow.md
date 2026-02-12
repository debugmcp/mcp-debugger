# tests\stress/
@generated: 2026-02-12T21:05:44Z

## Stress Testing Suite

The `tests/stress` directory contains comprehensive stress testing infrastructure for validating MCP (Model Context Protocol) transport layer reliability and debug functionality under extreme conditions. These tests are conditionally executed based on the `RUN_STRESS_TESTS` environment variable.

### Overall Purpose

This module serves as a quality assurance layer for MCP transport implementations, focusing on:
- **Transport Reliability**: Validating SSE and STDIO transports under high load
- **Cross-Transport Parity**: Ensuring identical behavior across different transport mechanisms
- **Stability Testing**: Verifying system resilience during extended operations and failure scenarios
- **Performance Validation**: Monitoring memory usage, connection success rates, and timing metrics

### Key Components

**Cross-Transport Validation (`cross-transport-parity.test.ts`)**:
- `TransportTester` class orchestrates debug operations across STDIO and SSE transports
- Validates identical results from complex debug sequences (session creation, breakpoints, stack traces, variables)
- Uses hardcoded test script (`examples/javascript/simple_test.js`) for consistent validation scenarios

**SSE Stress Testing (`sse-stress.test.ts`)**:
- `SSEStressTester` class manages server lifecycle and client connection pools
- Executes four distinct stress scenarios: rapid connections, burst load, long-running stability, and server recovery
- Tracks comprehensive metrics including success rates, memory usage, and error patterns

### Test Architecture

Both modules share common patterns:
- **Server Process Management**: Spawning and lifecycle control of MCP servers
- **Client Connection Orchestration**: Managing multiple concurrent client connections with proper cleanup
- **Metrics Collection**: Tracking performance indicators and success/failure rates
- **Health Checking**: Polling mechanisms for server readiness validation

### Entry Points

1. **`describeStress`**: Conditional test wrapper that respects `RUN_STRESS_TESTS` environment variable
2. **Transport Test Suites**: Main test functions that execute full stress scenarios
3. **Configuration Constants**: `TEST_TIMEOUT` (60-120s), port ranges (4000-4999), success rate thresholds

### Data Flow

1. **Setup Phase**: Environment validation, server spawning, port allocation
2. **Execution Phase**: Concurrent client operations with metric collection
3. **Validation Phase**: Success rate analysis, memory growth checks, result comparison
4. **Cleanup Phase**: Graceful resource disposal with fallback termination

### Integration Points

- **MCP SDK**: Leverages `StdioClientTransport` and `SSEClientTransport` for protocol implementation
- **Debug Tools**: Integrates with MCP debug capabilities for breakpoint and variable inspection
- **Test Framework**: Built on Vitest with custom timeout configurations and conditional execution
- **Process Management**: Uses Node.js `child_process` for server orchestration and `net` for port management

### Quality Assurance Patterns

The module enforces strict reliability standards:
- 80-90% minimum success rates for connection attempts
- <50MB memory growth tolerance for long-running operations
- Cross-transport result parity with ±1 tolerance for minor variations
- Comprehensive error capturing and reporting for failure analysis
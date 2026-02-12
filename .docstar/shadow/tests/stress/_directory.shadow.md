# tests\stress/
@generated: 2026-02-12T21:00:56Z

## Stress Testing Module

This directory contains comprehensive stress testing suites for validating MCP (Model Context Protocol) transport layer reliability and cross-transport parity under extreme conditions. The tests are designed to ensure robustness across different transport mechanisms (STDIO, SSE, Docker) and validate system behavior under load.

### Core Purpose

The stress testing module serves two primary functions:
1. **Cross-Transport Validation**: Ensures identical behavior and results across different MCP transport implementations
2. **Transport Reliability Testing**: Validates transport layer stability under high-load conditions, rapid connection cycling, and failure scenarios

### Key Components

**Cross-Transport Parity Testing** (`cross-transport-parity.test.ts`):
- **TransportTester**: Orchestrates debug operations across STDIO and SSE transports
- **Debug Sequence Validation**: Executes standardized 6-step debug workflow (session creation, breakpoints, execution, stack traces, variables, cleanup)
- **Result Comparison**: Validates identical outcomes across transports with tolerance for minor variations

**SSE Stress Testing** (`sse-stress.test.ts`):
- **SSEStressTester**: Manages stress testing scenarios for Server-Sent Events transport
- **Load Testing**: Rapid connect/disconnect cycles, burst connections, long-running stability
- **Recovery Testing**: Server failure and restart scenarios with client reconnection validation

### Test Architecture

**Conditional Execution**: All stress tests are gated by `RUN_STRESS_TESTS` environment variable, preventing accidental execution during normal test runs.

**Transport Management**:
- **STDIO**: Uses spawned server processes with StdioClientTransport
- **SSE**: Manages separate Node.js server instances with health check polling and random port allocation (4000-4999)
- **Process Lifecycle**: Comprehensive setup/teardown with graceful shutdown and SIGTERM/SIGKILL fallback

**Metrics Collection**:
- Connection success/failure rates with 80-90% success thresholds
- Memory usage monitoring with <50MB growth limits
- Timing metrics for performance validation
- Error tracking and detailed logging for debugging

### Public API Surface

**Test Entry Points**:
- Cross-transport parity validation with debug operation comparison
- SSE transport stress testing with 4 distinct load scenarios
- Comprehensive metrics collection and threshold validation

**Key Interfaces**:
- `DebugSequenceResult`: Captures debug session state and operations
- `TransportTestResult`: Wraps transport validation outcomes
- `TestMetrics`: Tracks performance and reliability metrics

### Critical Dependencies

**External Requirements**:
- Test script dependency: `examples/javascript/simple_test.js` (hardcoded breakpoint on line 11)
- MCP SDK components for client and transport implementations
- Node.js child_process for server spawning and management

**Configuration**:
- 60-120 second timeouts for complex operations
- Port range 4000-4999 for SSE server allocation
- Breakpoint targeting line 11 of JavaScript test file

### Internal Organization

The module follows a pattern-based approach with:
1. **Setup Phase**: Server spawning, health checks, port allocation
2. **Execution Phase**: Debug operations or stress scenarios
3. **Validation Phase**: Result comparison, metrics analysis, threshold checking
4. **Teardown Phase**: Graceful shutdown with fallback mechanisms

Both test suites use promise-based async patterns with comprehensive error handling and detailed console output for debugging test failures. The architecture supports parallel execution while maintaining test isolation through unique port allocation and separate process spaces.
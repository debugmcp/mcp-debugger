# tests\stress/
@children-hash: 38887d677bf7e56b
@generated: 2026-02-15T09:01:23Z

## Stress Testing Suite for MCP Transport Layer

This directory contains comprehensive stress testing modules that validate the reliability, performance, and parity of MCP (Model Context Protocol) transport implementations under extreme conditions.

### Overall Purpose

The stress testing suite serves three critical functions:
1. **Transport Parity Validation**: Ensures identical behavior across different transport mechanisms (STDIO, SSE, Docker)
2. **Reliability Under Load**: Tests transport resilience with rapid connections, burst traffic, and sustained operations
3. **Failure Recovery**: Validates graceful handling of server failures and connection recovery scenarios

### Core Components

**Cross-Transport Parity Testing (`cross-transport-parity.test.ts`)**:
- `TransportTester` class orchestrates identical debug operations across STDIO and SSE transports
- Executes 6-step debug sequence: session creation, breakpoint setting, script execution, stack trace retrieval, variable inspection, and cleanup
- Validates operational parity with tolerance for minor transport-specific variations (±1 stack frame difference)

**SSE Stress Testing (`sse-stress.test.ts`)**:
- `SSEStressTester` class manages server lifecycle and client connection pools
- Implements four stress scenarios: rapid connect/disconnect cycles, burst connections, long-running stability, and server recovery
- Collects comprehensive metrics on success rates, timing, memory usage, and error patterns

### Key Entry Points

**Conditional Execution**: Both modules use `RUN_STRESS_TESTS` environment variable to enable stress testing, preventing resource-intensive tests during regular development.

**Test Scenarios**:
- Cross-transport debug parity validation with hardcoded breakpoint testing
- Rapid connection cycling (20 cycles × 3 connections)
- Burst load testing (10 simultaneous connections)
- Long-running stability (15-second sustained operations)
- Server failure and recovery validation

### Internal Organization

**Shared Patterns**:
- Promise-based async orchestration with comprehensive error handling
- Process lifecycle management for server spawning and cleanup
- Metrics collection and validation with configurable success thresholds
- Port randomization for test isolation (4000-4999 range)

**Data Flow**:
1. Environment check determines test execution
2. Server processes spawned with health checks
3. Client connections established with metric tracking
4. Debug operations or stress scenarios executed
5. Results validated against success criteria
6. Cleanup and resource deallocation

### Transport Integration

The suite validates the complete MCP transport stack:
- **STDIO Transport**: Process-based communication via stdin/stdout
- **SSE Transport**: HTTP-based Server-Sent Events with polling health checks
- **Future Docker Support**: Framework ready for container-based transport testing

### Performance Characteristics

- 120-second timeout for complex stress operations
- 60-second timeout for cross-transport parity tests
- Memory growth thresholds (<50MB for sustained operations)
- Success rate requirements (80-90% under stress conditions)
- 2-second delays for async operation stabilization

This testing suite ensures MCP transport implementations maintain consistency, performance, and reliability across different deployment scenarios and operational conditions.
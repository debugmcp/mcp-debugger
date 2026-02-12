# tests/stress/
@generated: 2026-02-11T23:47:39Z

## Stress Testing Suite for MCP Transport Layer

The `tests/stress` directory provides comprehensive stress testing capabilities for the Model Context Protocol (MCP) transport layer, focusing on reliability, performance, and cross-transport consistency validation under extreme conditions.

### Overall Purpose

This module serves as a quality assurance suite that validates MCP transport implementations can handle production-level stress scenarios including rapid connection cycling, burst loads, long-running sessions, and failure recovery. The tests ensure transport parity and identify performance bottlenecks or reliability issues before deployment.

### Key Components

**Cross-Transport Validation (`cross-transport-parity.test.ts`)**:
- Primary orchestrator for validating identical behavior across STDIO and SSE transports
- `TransportTester` class manages transport lifecycle and executes standardized debug sequences
- Validates functional parity through comprehensive debug operations (session creation, breakpoints, stack traces, variable inspection)

**SSE-Specific Stress Testing (`sse-stress.test.ts`)**:
- Dedicated stress testing for SSE (Server-Sent Events) transport reliability
- `SSEStressTester` class orchestrates extreme load scenarios and failure conditions
- Comprehensive metrics collection for performance analysis and regression detection

### Public API Surface

**Main Entry Points**:
- Both test suites are conditionally executed via `RUN_STRESS_TESTS` environment variable
- Test suites integrate with Vitest framework for CI/CD pipeline integration
- Each component provides isolated testing capabilities for different transport aspects

**Key Test Scenarios**:
- **Cross-transport parity validation**: Ensures identical debug operations across transports
- **Rapid connection cycling**: Validates connection stability under frequent connect/disconnect patterns  
- **Burst load testing**: Tests concurrent connection handling capabilities
- **Long-running session stability**: Monitors memory leaks and sustained operation reliability
- **Server failure recovery**: Validates graceful handling of transport interruptions

### Internal Organization

**Shared Architecture Patterns**:
- Promise-based async operations with comprehensive error handling
- Process spawning for server isolation and realistic testing conditions
- Metrics collection and validation with configurable success thresholds
- Port management and health checking for transport setup

**Data Flow**:
1. Environment-based test activation via `RUN_STRESS_TESTS`
2. Server process spawning with random port allocation for isolation
3. Client transport setup and connection establishment
4. Stress scenario execution with metrics collection
5. Graceful cleanup and resource deallocation
6. Results validation against expected performance baselines

### Important Patterns

**Test Isolation**: Each test uses random port allocation and separate server processes to prevent interference
**Conditional Execution**: Stress tests are opt-in via environment variables to avoid impacting regular test runs
**Comprehensive Metrics**: Success rates, timing data, memory usage, and error tracking provide detailed performance insights
**Transport Abstraction**: Common testing patterns work across different MCP transport implementations
**Failure Resilience**: Tests validate both happy path and failure recovery scenarios

### Dependencies

- **MCP SDK**: Core client libraries and transport implementations (STDIO, SSE)
- **Node.js Runtime**: Process management, networking, and file system operations
- **Vitest Framework**: Test execution, conditional test control, and assertion utilities

This stress testing suite ensures MCP transport layer robustness and provides confidence in production deployment scenarios.
# tests/stress/
@generated: 2026-02-10T21:26:21Z

## Stress Testing Suite for MCP Transport Layers

This directory contains comprehensive stress testing infrastructure for validating the Model Context Protocol (MCP) transport implementations under extreme conditions and ensuring cross-transport compatibility.

### Overall Purpose

The stress test suite serves three critical functions:
1. **Cross-Transport Parity Validation**: Ensures identical behavior across STDIO, SSE, and Docker transport layers
2. **SSE Transport Reliability Testing**: Validates SSE transport performance under high load, rapid connections, and failure scenarios
3. **Production Readiness Assessment**: Provides confidence in transport layer stability before deployment

### Key Components

**Cross-Transport Parity Testing (`cross-transport-parity.test.ts`)**:
- `TransportTester` class orchestrates identical debug operations across multiple transports
- Validates debug session lifecycle: creation, breakpointing, execution, stack inspection, variable access
- Compares results between STDIO and SSE transports with tolerance for minor variations
- Ensures consistent MCP protocol behavior regardless of underlying transport

**SSE Stress Testing (`sse-stress.test.ts`)**:
- `SSEStressTester` class provides comprehensive SSE transport validation
- Tests rapid connection cycling, burst load handling, long-running stability, and server recovery
- Monitors memory usage, connection success rates, and operation timing
- Validates graceful degradation and recovery scenarios

### Public API Surface

**Test Execution Control**:
- All stress tests are gated by `RUN_STRESS_TESTS` environment variable
- `describeStress` wrapper enables conditional test execution
- 60-120 second timeouts accommodate complex operations

**Core Test Classes**:
- `TransportTester`: Cross-transport validation orchestrator
- `SSEStressTester`: SSE-specific stress testing framework

**Key Interfaces**:
- `DebugSequenceResult`: Captures debug session state and metrics
- `TransportTestResult`: Wraps transport test outcomes
- `TestMetrics`: Tracks performance and reliability metrics

### Internal Organization

**Transport Management**:
- Automated server process spawning and lifecycle management
- Health check polling for service readiness
- Graceful shutdown with fallback termination strategies
- Dynamic port allocation to avoid conflicts

**Debug Sequence Flow**:
1. Session creation with JavaScript language binding
2. Breakpoint placement on test script
3. Execution initiation and control
4. Stack frame and variable inspection
5. Session cleanup and validation

**Stress Testing Scenarios**:
- Rapid connect/disconnect cycles (20x3 connections)
- Burst load testing (10 simultaneous connections)
- Long-running stability validation (15+ seconds)
- Server failure and recovery testing

### Data Flow and Patterns

**Cross-Transport Pattern**:
1. Execute identical debug sequence on each transport
2. Collect structured results with timing and state information
3. Compare outcomes with tolerance for transport-specific variations
4. Validate parity in core functionality while allowing minor differences

**Stress Testing Pattern**:
1. Spawn isolated server processes with random port allocation
2. Execute concurrent client operations with metrics collection
3. Monitor system resources and connection health
4. Validate success rate thresholds and performance criteria

### Critical Dependencies

**External Requirements**:
- Test script dependency: `examples/javascript/simple_test.js`
- MCP SDK client libraries and transport implementations
- Node.js process management capabilities

**Configuration Constraints**:
- Hardcoded breakpoint locations for consistent testing
- Specific timeout windows for complex operations
- Memory growth thresholds for leak detection
- Success rate minimums for reliability validation

### Integration Points

The stress test suite validates the entire MCP transport stack from protocol-level operations through system resource management, ensuring production readiness across all supported transport mechanisms. Results provide confidence in cross-transport compatibility and performance under adverse conditions.
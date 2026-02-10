# tests/stress/
@generated: 2026-02-10T01:19:40Z

## Overall Purpose

The `tests/stress` directory contains comprehensive stress testing and integration validation for MCP (Model Context Protocol) transport layer implementations. This module ensures transport reliability, cross-protocol compatibility, and performance characteristics under extreme operational conditions.

## Key Components and Integration

**Cross-Transport Validation (`cross-transport-parity.test.ts`)**:
- Validates functional parity between STDIO and SSE transport protocols
- Executes identical debug workflows across both transports
- Compares results to ensure transport layer transparency
- Verifies debug operations (session creation, breakpoint setting, stack inspection) produce equivalent outcomes

**SSE Transport Stress Testing (`sse-stress.test.ts`)**:
- Validates SSE transport reliability under extreme load conditions
- Tests rapid connection cycling, burst connections, and long-running stability
- Monitors memory usage patterns and connection success rates
- Validates graceful handling of server failures and recovery scenarios

## Public API and Entry Points

**Test Control Interface**:
- Environment variable `RUN_STRESS_TESTS` gates all stress test execution
- Tests are conditionally skipped if stress testing is not explicitly enabled
- Designed for CI/CD integration with configurable test execution

**Primary Test Classes**:
- `TransportTester`: Orchestrates cross-transport debug sequence validation
- `SSEStressTester`: Manages SSE-specific stress testing scenarios and metrics collection

## Internal Organization and Data Flow

**Test Architecture Pattern**:
1. **Setup Phase**: Server process spawning, transport configuration, health checks
2. **Execution Phase**: Debug sequence orchestration or stress scenario execution
3. **Validation Phase**: Result comparison, metrics analysis, success criteria evaluation
4. **Cleanup Phase**: Resource disposal, process termination, connection cleanup

**Shared Infrastructure**:
- Both test suites spawn separate Node.js processes running the MCP server
- Port allocation uses randomization to prevent test interference
- Health check polling ensures server readiness before test execution
- Comprehensive error collection without test abortion

## Key Patterns and Conventions

**Transport Abstraction**: Tests validate that MCP functionality remains consistent regardless of underlying transport mechanism (STDIO vs SSE).

**Metrics-Driven Validation**: Stress tests use quantitative success criteria (connection success rates, memory growth limits, timing thresholds) rather than binary pass/fail.

**Resource Management**: Explicit cleanup patterns with graceful shutdown attempts followed by forceful termination as fallback.

**Fault Tolerance**: Error collection and analysis without immediately aborting test execution, allowing comprehensive failure pattern analysis.

**Test Isolation**: Random port allocation and independent server processes prevent cross-test interference in concurrent execution environments.

This module serves as the quality assurance foundation for MCP transport layer reliability, ensuring production deployments can handle both normal operational patterns and extreme stress conditions while maintaining functional consistency across transport protocols.
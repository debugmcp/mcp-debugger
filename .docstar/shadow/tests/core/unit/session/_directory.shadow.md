# tests\core\unit\session/
@children-hash: 2eda2672297e1e17
@generated: 2026-02-15T09:01:27Z

## Purpose
Unit test suite for the SessionManager module, comprehensively testing the debugMCP system's core session management capabilities. Validates session lifecycle management, DAP (Debug Adapter Protocol) operations, error recovery, memory management, and multi-session scenarios through isolated unit tests.

## Test Organization
This directory contains 10 test files, each focusing on specific aspects of SessionManager functionality:

### Core Functionality Tests
- **session-manager-workflow.test.ts**: End-to-end integration workflows testing complete debug session lifecycles
- **session-manager-state.test.ts**: State machine integrity validation for proper state transitions (CREATED → INITIALIZING → PAUSED/RUNNING → STOPPED/ERROR)
- **session-manager-dap.test.ts**: Debug Adapter Protocol operations including breakpoints, stepping, variable inspection, and stack traces

### Error Handling & Resilience
- **session-manager-error-recovery.test.ts**: Proxy crash recovery and timeout handling scenarios
- **session-manager-edge-cases.test.ts**: Boundary conditions, error propagation, and failure modes
- **session-manager-dry-run.test.ts**: Race conditions and timing issues in dry run operations

### System Integration & Resource Management
- **session-manager-integration.test.ts**: Cross-component behavior including event handling, logging, and session persistence
- **session-manager-memory-leak.test.ts**: Event listener cleanup and memory leak prevention
- **session-manager-multi-session.test.ts**: Concurrent session management and state isolation

### Platform & Configuration
- **session-manager-paths.test.ts**: Path resolution across different operating systems and formats
- **models.test.ts**: Session state mapping and model definitions, including backward compatibility

## Key Components & Architecture

### SessionManager Under Test
The primary system under test is SessionManager, which orchestrates:
- Debug session lifecycle management through state machine
- DAP protocol communication via ProxyManager
- Event handling and forwarding from debug adapters
- Resource cleanup and memory management
- Multi-session concurrency and isolation

### Mock Infrastructure
Centralized through **session-manager-test-utils.ts**:
- `createMockDependencies()`: Provides complete mock environment including ProxyManager, file system, logger, network manager
- MockProxyManager: Simulates debug adapter communication with controllable behavior
- Fake timers and event simulation for deterministic testing

### State Management Testing
Tests validate the dual-state model transition from legacy SessionState enum to separate lifecycle/execution states:
- **Lifecycle States**: CREATED, ACTIVE, TERMINATED
- **Execution States**: INITIALIZING, RUNNING, PAUSED, TERMINATED, ERROR
- Bidirectional mapping functions for backward compatibility

## Testing Patterns

### Isolation & Control
- Extensive use of Vitest fake timers (`vi.useFakeTimers()`) for controlled async testing
- Mock dependency injection prevents real system dependencies
- Event simulation through mock proxy managers for predictable behavior

### Comprehensive Coverage
- Happy path workflows and error scenarios
- Race conditions and timing edge cases
- Memory leak prevention and resource cleanup
- Cross-platform compatibility (Windows/Unix paths)
- Concurrent session management

### Error Resilience
- Proxy crash recovery and restart capabilities
- Timeout handling with graceful degradation
- Event listener cleanup on failures
- Proper error state transitions

## Critical Test Scenarios

### Session Lifecycle
Complete debug session workflows from creation through termination, including breakpoint management, stepping operations, and variable inspection.

### Error Recovery
Proxy process crashes, network timeouts, DAP command failures, and cleanup after errors to ensure system stability.

### Concurrency
Multiple simultaneous debugging sessions with proper state isolation and resource management without conflicts.

### Memory Management
Event listener attachment/removal, cleanup on session close, and prevention of memory leaks during repeated session cycles.

## Dependencies
- **SessionManager**: Main class under test from `../../../../src/session/session-manager.js`
- **@debugmcp/shared**: Provides enums (DebugLanguage, SessionState) and type definitions
- **Vitest**: Test framework with comprehensive mocking and timing control
- **Mock utilities**: Centralized test doubles for all external dependencies

This test suite ensures SessionManager's reliability as the core orchestrator of debugging sessions in the debugMCP system, validating both normal operations and exceptional conditions across various usage patterns.
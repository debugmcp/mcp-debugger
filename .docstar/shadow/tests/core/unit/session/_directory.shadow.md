# tests\core\unit\session/
@children-hash: 1a9e3b31ae3f19b3
@generated: 2026-02-19T23:48:16Z

## Purpose
Comprehensive unit test suite for the SessionManager component of the debugMCP system. Tests all aspects of debug session lifecycle management, from creation through termination, with emphasis on edge cases, error recovery, and multi-session scenarios.

## Test Organization and Coverage

### Core Functionality Testing
- **models.test.ts**: Tests session state mapping functions and model definitions, focusing on backward compatibility between legacy SessionState enum and new dual-state model (lifecycle + execution states)
- **session-manager-workflow.test.ts**: Integration tests for complete debug workflows including session creation, debugging start/stop, breakpoint management, and stepping operations
- **session-manager-integration.test.ts**: Cross-component integration testing covering event handling, logging, and session persistence

### Debug Adapter Protocol (DAP) Operations
- **session-manager-dap.test.ts**: Comprehensive testing of DAP operations including breakpoint management, stepping operations, variable inspection, and stack trace retrieval
- **session-manager-state.test.ts**: State machine integrity testing ensuring proper state transitions and error handling throughout debug lifecycle

### Error Handling and Edge Cases
- **session-manager-error-recovery.test.ts**: Proxy crash recovery and timeout handling validation
- **session-manager-edge-cases.test.ts**: Comprehensive error scenario testing for robustness and graceful degradation
- **session-manager-dry-run.test.ts**: Race condition testing specific to dry run operations with timing-sensitive behavior

### Resource Management and Performance
- **session-manager-memory-leak.test.ts**: Event listener cleanup validation to prevent memory leaks
- **session-manager-multi-session.test.ts**: Concurrent session handling, state isolation, and bulk operations testing

### Platform Compatibility
- **session-manager-paths.test.ts**: Path resolution testing across different operating systems and path formats

### Test Infrastructure
- **session-manager-test-utils.ts**: Centralized mock dependencies and setup utilities ensuring consistent test isolation across all SessionManager test suites

## Key Testing Patterns

### Mock-Based Testing
All tests use comprehensive mock dependencies via `createMockDependencies()` utility, providing:
- MockProxyManager for DAP protocol simulation
- Mock file system, logger, and network components
- Fake timers for precise timing control in async operations
- Mock environment and configuration management

### State Management Validation
Tests extensively validate session state transitions:
- CREATED → INITIALIZING → PAUSED/RUNNING → STOPPED/ERROR
- Bidirectional state mapping compatibility
- Edge case handling for invalid state transitions

### Event-Driven Architecture Testing
Validates event handling between SessionManager and proxy components:
- Event forwarding and propagation
- Cleanup of event listeners to prevent memory leaks
- Race condition handling in event timing

## Critical Test Scenarios

### Error Recovery and Resilience
- Proxy crashes and restart capability
- DAP command timeouts and failures
- Network errors and connection issues
- Partial failure handling with continued operation

### Multi-Session Management
- Concurrent session creation and management
- Session state isolation
- Bulk operations (closeAllSessions)
- Resource cleanup across multiple sessions

### Performance and Resource Management
- Memory leak prevention through proper cleanup
- Event listener management
- Timer-based operation testing
- Resource allocation and deallocation

## Dependencies and Infrastructure
- **Vitest**: Primary testing framework with fake timer support
- **@debugmcp/shared**: Shared types and enums for state management
- **Mock Utilities**: Centralized mocking infrastructure for consistent test isolation
- **SessionManager**: Core class under test from session management module

## Architectural Validation
Tests validate key architectural decisions:
- Separation of session lifecycle from execution state
- DAP protocol abstraction and error handling
- Event-driven communication patterns
- Path resolution delegation to server level
- Dependency injection for testability

This test suite ensures the SessionManager component is robust, performant, and reliable across all supported debugging scenarios and failure modes.
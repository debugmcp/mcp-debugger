# tests\integration\rust/
@children-hash: 1c3187f84782bd3b
@generated: 2026-02-19T23:48:11Z

## Purpose and Responsibility

This directory contains integration tests for Rust debugging support within the DebugMCP framework. It focuses on end-to-end testing of the Rust debugging adapter, validating that the complete debugging infrastructure works correctly for Rust projects from session creation through breakpoint management to cleanup.

## Key Components and Integration

The directory contains a single comprehensive test suite (`rust-integration.test.ts`) that exercises the full Rust debugging workflow:

- **Session Management Integration**: Tests the creation, retrieval, and lifecycle management of Rust debugging sessions through the `SessionManager`
- **Adapter Configuration**: Validates proper setup of Rust-specific debugging configurations including DAP launch arguments
- **Breakpoint System**: Verifies breakpoint setting and status verification for Rust source files
- **Project Recognition**: Tests Cargo project detection and handling

## Public API Surface

**Main Test Entry Point**:
- `Rust Adapter Integration` test suite - Complete integration test coverage for Rust debugging functionality

**Key Test Scenarios**:
- Session creation with Rust language specification
- Session persistence and retrieval across test methods  
- Breakpoint management with graceful degradation
- Session cleanup and resource management

## Internal Organization and Data Flow

**Test Execution Flow**:
1. **Setup Phase**: Initialize `SessionManager` with production dependencies, configure temporary directories for logs and session data
2. **Session Creation**: Create new debugging session with Rust language configuration
3. **Session Validation**: Verify session properties and retrieval mechanisms
4. **Breakpoint Testing**: Attempt breakpoint setting on example Rust files with fallback handling
5. **Cleanup Phase**: Proper session termination and resource cleanup

**Dependency Integration**:
- Uses production `SessionManager` and dependency injection container for realistic testing
- Integrates with shared language constants from `@debugmcp/shared`
- Leverages Node.js filesystem utilities for temporary directory management

## Important Patterns and Conventions

**Graceful Degradation**: Tests are designed to pass even when example Rust projects or compiled binaries are not present, using try-catch patterns for optional test scenarios.

**Resource Management**: Implements proper setup/teardown with temporary directories to avoid filesystem conflicts and ensure test isolation.

**Production Environment Testing**: Uses actual production dependencies rather than mocks to validate real integration behavior.

**Session State Persistence**: Maintains session references across test methods to verify session lifecycle and cross-operation functionality.

**Logging Integration**: Configures debug logging with custom file locations for troubleshooting integration issues.

This directory serves as the primary validation point for Rust debugging capabilities, ensuring the adapter correctly integrates with the broader DebugMCP debugging infrastructure and handles Rust-specific requirements like Cargo project recognition and source file debugging.
# tests\integration\rust/
@generated: 2026-02-12T21:00:50Z

## Purpose
This directory contains integration tests for the Rust programming language support within the debugging adapter system. It serves as a validation layer ensuring the debugging infrastructure correctly handles Rust-specific scenarios including session management, breakpoint operations, and Cargo project integration.

## Key Components
- **rust-integration.test.ts**: Comprehensive integration test suite that validates end-to-end Rust debugging functionality using the vitest testing framework

## Test Coverage Areas
The integration tests validate critical debugging workflows:
- **Session Lifecycle**: Creation, configuration, and cleanup of Rust debug sessions
- **Cargo Project Support**: Verification of Cargo-based project detection and language identification
- **Breakpoint Management**: Setting and validation of breakpoints in Rust source files
- **Error Resilience**: Graceful handling of missing files and test environment variations

## Integration Points
The test suite integrates with core system components:
- **SessionManager**: Primary interface for debug session orchestration
- **Production Dependencies**: Full dependency injection container for realistic testing
- **File System Operations**: Path resolution and temporary directory management
- **Debug Language Constants**: Rust-specific debugging configuration

## Test Architecture
- **Sequential Test Flow**: Tests maintain state through shared session identifiers, creating dependency chains that mirror real debugging workflows
- **Isolated Environment**: Uses temporary directories and log files to prevent test interference
- **Production Configuration**: Tests against actual production dependencies rather than mocks for higher fidelity validation
- **Graceful Degradation**: Handles missing test resources without failing the entire suite

## Entry Points
The main entry point is the "Rust Adapter Integration" test suite, which can be executed independently or as part of the broader integration test pipeline. Tests are designed to validate the complete Rust debugging adapter functionality from session creation through cleanup.

## Testing Patterns
- Async/await throughout for proper handling of debugging operations
- Resource cleanup via afterAll hooks to prevent test pollution
- Try-catch blocks for optional scenarios that depend on external test files
- Debug-level logging with temporary log files for troubleshooting integration issues
# tests/integration/rust/
@generated: 2026-02-10T21:26:19Z

## Purpose
Integration testing directory for Rust debugging capabilities, providing end-to-end validation of the Rust debugging adapter's core functionality including session management, breakpoint handling, and Cargo project integration.

## Key Components
- **rust-integration.test.ts**: Comprehensive test suite that validates the complete Rust debugging workflow from session creation through cleanup

## Test Coverage Areas
The integration tests validate:
- **Session Lifecycle Management**: Creation, validation, and proper cleanup of Rust debug sessions
- **Language-Specific Handling**: Rust/Cargo project detection and configuration
- **Breakpoint Operations**: Setting breakpoints in Rust source files with graceful failure handling
- **DAP Integration**: Debug Adapter Protocol compliance for Rust debugging scenarios

## Dependencies and Configuration
- Integrates with the core `SessionManager` and dependency injection system
- Uses production-level dependencies with test-specific logging configuration
- Requires example Rust project structure (`examples/rust/hello_world/`) for realistic testing
- Configured with debug-level logging to temporary files for test isolation

## Test Architecture
- **Isolated Environment**: Uses temporary directories and logging to avoid test interference
- **Sequential Testing**: Maintains session state across test cases to validate complete workflows
- **Graceful Degradation**: Handles missing test files and optional scenarios without failing the suite
- **Resource Management**: Proper setup/teardown with afterAll hooks for cleanup

## Entry Points
- Primary test execution through vitest framework
- Test data sourced from `examples/rust/` directory structure
- Integration with shared debugging constants and session management APIs

## Error Handling Strategy
Implements robust error handling patterns including try-catch blocks for optional scenarios, graceful handling of missing test files, and proper async/await usage throughout the test suite.
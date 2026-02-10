# tests/integration/
@generated: 2026-02-10T21:26:33Z

## Purpose
This directory provides comprehensive integration testing for language-specific debugging capabilities within the VSCode debugging extension. It serves as the validation layer for end-to-end debugging workflows, ensuring that the debugging adapter correctly handles real-world scenarios across different programming languages and their respective toolchains.

## Key Components and Organization
The directory is organized by programming language, with each subdirectory containing focused integration test suites:

- **rust/**: Complete integration testing for Rust debugging capabilities, including Cargo project handling, session lifecycle management, and Debug Adapter Protocol (DAP) compliance

Each language-specific test directory provides comprehensive coverage of:
- Session creation, management, and cleanup workflows
- Language-specific project detection and configuration
- Breakpoint operations with graceful error handling
- Debug adapter protocol integration and compliance

## Test Architecture and Patterns
The integration tests follow a consistent architectural pattern across languages:

- **Isolated Test Environment**: Uses temporary directories and separate logging to prevent test interference
- **Sequential Workflow Testing**: Maintains session state across test cases to validate complete debugging scenarios
- **Graceful Degradation**: Handles missing test files and optional scenarios without failing the entire test suite
- **Resource Management**: Implements proper setup/teardown with cleanup hooks

## Public API and Entry Points
- **Test Execution**: Primary entry through vitest framework for all language-specific test suites
- **Test Data Integration**: Consumes example projects from `examples/` directory for realistic testing scenarios
- **Dependency Integration**: Interfaces with core `SessionManager` and dependency injection systems
- **Configuration Management**: Integrates with shared debugging constants and session management APIs

## Data Flow and Dependencies
The integration tests operate in a layered approach:
1. **Setup Phase**: Initializes isolated test environments with temporary logging and directories
2. **Session Management**: Creates and validates debug sessions using production-level dependencies
3. **Workflow Validation**: Executes complete debugging scenarios including breakpoint operations
4. **Cleanup Phase**: Ensures proper resource disposal and session termination

## Important Conventions
- **Error Handling**: Implements robust try-catch patterns for optional scenarios and missing test files
- **Async Operations**: Consistent use of async/await throughout test suites for proper asynchronous handling
- **Logging Strategy**: Debug-level logging to temporary files for test isolation and debugging
- **Test Isolation**: Each test suite operates independently while maintaining realistic integration scenarios

## Role in Larger System
This integration testing layer serves as the critical validation point between unit tests and production usage, ensuring that the debugging extension's language adapters function correctly in realistic development environments. It validates the complete integration chain from VSCode debugging interface through the Debug Adapter Protocol to language-specific debugging tools.
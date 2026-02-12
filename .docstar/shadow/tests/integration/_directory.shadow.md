# tests\integration/
@generated: 2026-02-12T21:01:04Z

## Purpose
The `tests/integration` directory serves as the comprehensive integration testing layer for the debugging adapter system. It validates end-to-end functionality across different programming language ecosystems, ensuring that the debugging infrastructure correctly handles language-specific scenarios, session management, and debugging workflows in production-like environments.

## Key Components
- **rust/**: Complete integration test suite for Rust programming language debugging support, including Cargo project integration and language-specific debugging operations

## Testing Architecture
The integration tests are organized by programming language to provide focused validation of language-specific debugging features while maintaining a consistent testing framework:

- **Language-Specific Validation**: Each language subdirectory contains comprehensive tests for that language's debugging adapter implementation
- **Production Environment Testing**: Tests run against actual production dependencies rather than mocks to ensure high-fidelity validation
- **End-to-End Workflows**: Complete debugging session lifecycles from creation through cleanup are tested

## Core Testing Patterns
- **Session Lifecycle Management**: Validates debug session creation, configuration, and proper cleanup across different language environments
- **Breakpoint Operations**: Tests setting, managing, and validating breakpoints within language-specific source files
- **Project Integration**: Verifies proper detection and handling of language-specific project structures (e.g., Cargo for Rust)
- **Error Resilience**: Ensures graceful handling of missing resources and environmental variations

## Integration Points
The integration tests validate interactions with critical system components:
- **SessionManager**: Primary debugging session orchestration interface
- **Language Adapters**: Language-specific debugging protocol implementations
- **File System Operations**: Path resolution, temporary directories, and resource management
- **Debug Protocol**: Compliance with debugging adapter protocol specifications

## Public API Surface
Integration tests can be executed through standard testing frameworks (vitest) and are designed to:
- Run independently per language or as a complete suite
- Provide detailed logging for debugging test failures
- Support CI/CD pipeline integration with proper exit codes and reporting
- Handle optional test scenarios that depend on external test resources

## Data Flow and Organization
Tests follow a structured flow pattern:
1. **Setup Phase**: Initialize temporary environments, logging, and test resources
2. **Session Creation**: Establish debugging sessions with language-specific configurations
3. **Operation Validation**: Execute debugging operations (breakpoints, stepping, evaluation)
4. **State Verification**: Validate expected debugging states and responses
5. **Cleanup Phase**: Properly dispose of sessions and temporary resources

The directory structure allows for easy extension to additional programming languages while maintaining consistent testing patterns and infrastructure across all language adapters.
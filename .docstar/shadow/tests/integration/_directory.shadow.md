# tests\integration/
@generated: 2026-02-12T21:05:57Z

## Purpose
The `tests/integration` directory provides comprehensive end-to-end validation of the debugging system's language-specific adapters through realistic integration testing. This module ensures that debugging adapters can properly manage debug sessions, interact with language toolchains, and maintain proper resource lifecycle management in production-like environments.

## Key Components and Organization
The directory is organized by programming language, with each subdirectory containing dedicated integration test suites:

- **rust/**: Rust debugging adapter integration tests that validate Cargo project handling, session management, and Rust-specific debugging workflows
- Additional language subdirectories follow the same organizational pattern for consistent testing structure

## Testing Architecture
The integration tests employ a sophisticated architecture designed for realistic validation:

- **Production Environment Simulation**: Uses actual production dependency injection containers rather than mocks to ensure authentic system behavior
- **Resource Isolation**: Implements temporary directories, isolated log files, and clean session management to prevent test interference
- **Sequential Test Flows**: Maintains session state across related test cases to validate complete debugging workflows
- **Graceful Error Handling**: Incorporates resilient error handling for missing test resources and optional scenarios

## Integration Points
The test suite validates critical system interactions:

- **SessionManager Integration**: Validates debug session lifecycle management including creation, configuration, and cleanup
- **Language Detection**: Verifies proper recognition and handling of language-specific project structures (e.g., Cargo for Rust)
- **Debug Adapter Protocol (DAP)**: Tests DAP compliance with proper configuration for breakpoints, stepping, and debugging modes
- **File System Operations**: Validates source code file handling, temporary resource management, and project navigation

## Public API and Entry Points
The main entry points for integration testing are:

- **Language-specific test suites**: Each subdirectory contains vitest-based test suites that can be executed independently or as part of the complete integration test suite
- **Test execution through standard testing frameworks**: Compatible with vitest and other JavaScript testing frameworks
- **CI/CD integration**: Designed for automated testing pipelines with proper exit codes and logging

## Configuration Patterns
The integration tests follow consistent configuration patterns:

- **Debug-level logging** with isolated temporary log files for comprehensive test visibility
- **DAP configuration** with standardized settings for stop-on-entry, just-my-code debugging, and breakpoint management
- **Example project references** that point to realistic code samples in the `examples/` directory structure
- **Environment-specific settings** that adapt to different testing contexts while maintaining consistent behavior

## Data Flow
Integration tests follow a typical flow pattern:
1. **Setup Phase**: Initialize temporary resources, configure logging, and prepare test environment
2. **Session Creation**: Instantiate debug sessions using production SessionManager with language-specific configurations
3. **Validation Phase**: Execute debugging operations (breakpoints, stepping, variable inspection) and validate responses
4. **Cleanup Phase**: Properly dispose of sessions, clean temporary resources, and reset state for subsequent tests

This directory serves as the primary validation layer ensuring that the debugging system's language adapters work correctly in realistic scenarios, providing confidence for production deployments.
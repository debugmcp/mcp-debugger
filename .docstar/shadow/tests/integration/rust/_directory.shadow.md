# tests\integration\rust/
@generated: 2026-02-12T21:05:39Z

## Purpose
Integration testing module for the Rust debugging adapter, providing end-to-end validation of Rust language debugging capabilities within the larger debugging system. This directory contains comprehensive test suites that verify the debugging adapter's ability to manage Rust debug sessions, handle Cargo projects, and interact with Rust source code.

## Key Components
- **rust-integration.test.ts**: Primary integration test suite that validates core Rust debugging functionality including session lifecycle management, Cargo project detection, breakpoint operations, and resource cleanup

## Test Coverage Areas
- **Session Management**: Creation, configuration, and cleanup of Rust debug sessions
- **Cargo Project Support**: Validation of Cargo-based Rust project handling and language detection  
- **Breakpoint Operations**: Setting breakpoints in Rust source files with graceful error handling
- **Resource Management**: Proper cleanup of temporary resources and session state

## Integration Points
The tests interact with several core system components:
- `SessionManager` for debug session orchestration
- Production dependency injection container for realistic testing environment
- `DebugLanguage.RUST` constants for language-specific configuration
- File system utilities for test file and temporary directory management

## Test Architecture
- **Environment Isolation**: Uses temporary directories and log files to prevent test interference
- **Sequential Test Flow**: Maintains session state across test cases through shared `sessionId` variable
- **Production-like Setup**: Utilizes actual production dependencies rather than mocks for authentic integration testing
- **Error Resilience**: Implements graceful handling of missing test files and optional test scenarios

## Configuration Patterns
- Debug-level logging with temporary log files for test isolation
- DAP (Debug Adapter Protocol) settings configured for stop-on-entry and just-my-code debugging
- References example Rust projects (`examples/rust/hello_world/src/main.rs`) for realistic test scenarios

## Entry Points
The main entry point is the vitest test suite in `rust-integration.test.ts`, which can be executed as part of the larger integration test framework to validate Rust debugging adapter functionality end-to-end.
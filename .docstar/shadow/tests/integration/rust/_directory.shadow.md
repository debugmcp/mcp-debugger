# tests/integration/rust/
@generated: 2026-02-10T01:19:34Z

## Purpose
Integration testing directory specifically for validating Rust debugging adapter functionality within the larger debugging system. Provides comprehensive end-to-end testing of Rust debug session lifecycle, breakpoint management, and Cargo project integration.

## Key Components
- **rust-integration.test.ts**: Complete integration test suite covering the full Rust debugging workflow from session creation through cleanup

## Test Coverage Areas
- **Session Management**: Creation, retrieval, and proper lifecycle management of Rust debug sessions
- **Language Integration**: Validation of Rust-specific debugging capabilities and language detection
- **Breakpoint Operations**: Setting and managing breakpoints in Rust source files with error handling
- **Cargo Project Support**: Testing integration with Cargo-based Rust projects and workspace handling
- **Resource Management**: Proper cleanup and teardown of test resources and temporary files

## Testing Architecture
- **Framework**: Built on vitest testing framework for modern async test execution
- **Dependencies**: Integrates with production dependency injection container and SessionManager
- **Isolation**: Uses temporary directories and log files for test data separation
- **Configuration**: Employs realistic DAP settings (stop on entry, just-my-code debugging)

## Integration Points
- **SessionManager**: Core integration point for debugging session orchestration
- **Production Dependencies**: Uses actual production dependency container for realistic testing
- **File System**: References example Rust projects (`examples/rust/hello_world/src/main.rs`)
- **Logging System**: Temporary debug-level logging for test observation

## Test Flow Pattern
Maintains sequential state through shared `sessionId`, creating a realistic debugging session workflow that mirrors actual user interactions with the Rust debugging adapter.

## Error Handling Strategy
Implements graceful degradation for missing test files and optional scenarios, ensuring tests remain stable even when example projects are unavailable while still validating core functionality.
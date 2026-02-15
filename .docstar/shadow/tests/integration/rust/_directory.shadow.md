# tests\integration\rust/
@children-hash: 35647abea0975bdd
@generated: 2026-02-15T09:01:18Z

## Purpose
Integration test directory focused on validating Rust debugging adapter functionality within the broader debugging system. This module ensures end-to-end functionality of Rust-specific debugging capabilities including session management, breakpoint operations, and Cargo project handling.

## Key Components
- **rust-integration.test.ts**: Comprehensive integration test suite that validates the complete Rust debugging workflow from session creation through cleanup
- **Test Infrastructure**: Production-grade dependency injection setup with isolated logging and temporary storage
- **Test Scenarios**: Sequential test flow covering session lifecycle, project validation, breakpoint management, and resource cleanup

## Testing Scope & Flow
The integration tests follow a structured workflow:
1. **Environment Setup**: Creates isolated test environment with production dependencies and temporary logging
2. **Session Management**: Validates Rust debug session creation and property verification
3. **Project Integration**: Tests Cargo project detection and language validation
4. **Breakpoint Operations**: Verifies breakpoint setting capabilities with graceful failure handling for missing files
5. **Resource Cleanup**: Ensures proper session termination and state management

## Integration Points
- **SessionManager**: Core dependency for orchestrating debug sessions
- **Dependency Container**: Uses production dependency injection for realistic testing
- **File System**: References example Rust projects (`examples/rust/hello_world/src/main.rs`)
- **Logging System**: Integrates with temporary logging infrastructure for test isolation

## Test Configuration
- **Language Target**: `DebugLanguage.RUST` constant for type safety
- **DAP Settings**: Configured with stop-on-entry and just-my-code debugging
- **Isolation Strategy**: Temporary directories and log files prevent test interference
- **Error Resilience**: Graceful handling of missing test files and async operations

## Public API Surface
The directory serves as a validation layer for:
- Rust debugging session creation and management
- Cargo project detection and handling
- Breakpoint setting and validation
- Session lifecycle management (creation through cleanup)

## Testing Patterns
- **Sequential Dependencies**: Tests maintain state through shared `sessionId` variable
- **Resource Management**: Proper setup/teardown with afterAll cleanup hooks
- **Error Handling**: Try-catch blocks for optional scenarios and graceful degradation
- **Async Testing**: Comprehensive async/await usage with proper error propagation
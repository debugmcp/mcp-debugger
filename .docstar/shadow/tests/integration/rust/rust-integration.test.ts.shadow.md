# tests/integration/rust/rust-integration.test.ts
@source-hash: c0d7e30098b575a7
@generated: 2026-02-10T01:18:53Z

## Purpose
Integration test suite for the Rust debugging adapter, validating session management, breakpoint setting, and Cargo project handling using the vitest testing framework.

## Test Structure
- **Main Test Suite** (L11-85): "Rust Adapter Integration" - comprehensive test suite for Rust debugging functionality
- **Setup/Teardown** (L15-34): Creates production dependencies with temporary logging, initializes SessionManager with test configuration
- **Session Creation Test** (L36-47): Validates basic Rust debug session creation and property verification
- **Cargo Project Test** (L49-56): Verifies session retrieval and language validation for Cargo-based projects
- **Breakpoint Test** (L58-76): Tests breakpoint setting in Rust source files with graceful failure handling
- **Session Cleanup Test** (L78-84): Validates proper session closure and state management

## Key Dependencies
- `SessionManager` from session management module - core debugging session orchestration
- `createProductionDependencies` from dependency injection container
- `DebugLanguage.RUST` from shared debugging constants
- Standard Node.js modules: `path`, `os` for file system operations

## Test Configuration
- **Logging**: Debug level with temporary log file (`rust-integration-test.log`)
- **Session Storage**: Temporary directory for session data isolation
- **DAP Settings**: Stop on entry and just-my-code debugging enabled
- **Test File**: References `examples/rust/hello_world/src/main.rs` for breakpoint testing

## Error Handling Patterns
- Graceful degradation for missing test files (L62-75)
- Proper async/await usage throughout
- Resource cleanup via afterAll hook (L32-34)
- Try-catch blocks for optional test scenarios

## Test Flow Dependencies
Tests maintain state through `sessionId` variable, creating a sequential dependency chain: creation → validation → breakpoint setting → cleanup.
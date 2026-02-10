# tests/integration/rust/rust-integration.test.ts
@source-hash: b8ee1e8d0b94cc24
@generated: 2026-02-09T18:14:40Z

## Integration Test Suite for Rust Debug Adapter

**Primary Purpose:** Validates end-to-end functionality of the Rust debug adapter within the debug session management system using Vitest testing framework.

### Test Structure & Setup
- **Main Test Suite** (L11-87): "Rust Adapter Integration" - comprehensive integration testing for Rust debugging capabilities
- **Setup Hook** (L15-30): Creates production dependencies with debug logging and configures SessionManager with temporary directories for isolated testing
- **Teardown Hook** (L32-34): Ensures proper cleanup by closing all active debug sessions

### Key Test Components
- **Dependencies** (L16-19): Production-grade dependency injection with debug logging to temporary files
- **Session Configuration** (L21-27): Configures DAP launch arguments with `stopOnEntry` and `justMyCode` flags
- **SessionManager Instance** (L29): Central orchestrator for debug session lifecycle management

### Test Cases
1. **Session Creation Test** (L36-47): Validates basic Rust debug session instantiation and property verification
2. **Cargo Project Handling** (L49-57): Tests session retrieval and language verification (currently placeholder implementation)
3. **Breakpoint Management** (L59-78): Tests breakpoint setting in Rust source files with graceful failure handling when test files are unavailable
4. **Session Cleanup** (L80-86): Verifies proper session termination and state management

### Architecture Dependencies
- **SessionManager**: Core session lifecycle management from `../../../src/session/session-manager.js`
- **Dependencies Container**: Production dependency injection from `../../../src/container/dependencies.js`
- **Shared Types**: `DebugLanguage.RUST` enum from `@debugmcp/shared` package
- **Node.js Modules**: `path` and `os` for cross-platform file system operations

### Testing Patterns
- Uses temporary directories for isolation (`os.tmpdir()`)
- Implements graceful degradation for missing test fixtures (L64-77)
- Maintains session state across test cases via shared `sessionId` variable
- Follows standard setup/teardown pattern for resource management

### Critical Constraints
- Requires test Rust project files in `examples/rust/hello_world/src/main.rs` for full breakpoint testing
- Tests are designed to pass even when sample projects are unavailable
- Logging output directed to temporary files to avoid test pollution
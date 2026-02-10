# packages/adapter-rust/tests/rust-debug-adapter.toolchain.test.ts
@source-hash: 1188b2e27e752851
@generated: 2026-02-09T18:14:44Z

## RustDebugAdapter Toolchain Test Suite

Comprehensive integration test suite for `RustDebugAdapter`'s toolchain management, environment validation, and DAP (Debug Adapter Protocol) functionality. Tests the adapter's ability to resolve executables, validate Rust toolchains, handle platform-specific configurations, and manage debug session lifecycle.

### Test Structure

**Test Dependencies Setup (L1-46)**: Mocks critical utilities including rust-utils, codelldb-resolver, binary-detector, and cargo-utils. Creates mock filesystem, logger, environment, and process launcher dependencies.

**Helper Functions**:
- `createDependencies()` (L47-79): Factory for mock `AdapterDependencies` with stubbed filesystem, logger, environment, and process launcher
- `setPlatform()` (L81-87): Platform override utility for cross-platform testing with automatic cleanup

### Core Test Categories

**Executable Resolution Tests (L113-157)**: 
- Tests caching behavior and fallback logic from cargo → rustc → placeholder
- Validates file system checks and error handling for missing executables
- Covers environment variable-based relaxed toolchain mode (`MCP_RUST_ALLOW_PREBUILT`)

**Environment Validation Tests (L159-190)**:
- CodeLLDB availability detection and MSVC toolchain warnings
- Windows-specific dlltool validation for GNU toolchain
- Cross-platform compatibility checks

**Build Command Environment Tests (L192-232)**:
- Windows-specific environment variable injection (LLDB_USE_NATIVE_PDB_READER, DLLTOOL)
- PATH manipulation for CodeLLDB integration
- Dynamic mock setup for internal method testing

**Launch Configuration Transformation Tests (L234-306)**:
- Cargo project detection and binary resolution
- Build system integration (rebuild detection, cargo build execution)
- Source-to-binary path transformation with platform-specific extensions
- Error propagation for build failures

**Toolchain Validation Tests (L308-349)**:
- Binary format detection (MSVC vs GNU toolchain compatibility)
- MSVC behavior configuration via `RUST_MSVC_BEHAVIOR` environment variable
- Toolchain validation result caching and consumption
- Error handling for detection failures

**DAP Operations Tests (L351-417)**:
- Exception filter validation with warning generation
- State management during debug session lifecycle (CONNECTED → DEBUGGING → CONNECTED)
- Event/response handling for stopped, terminated, and error conditions
- Connection lifecycle management with event emission

**Platform Utilities Tests (L419-526)**:
- Dependency listing with installation commands
- Platform-specific executable search path generation (Linux, Windows)
- Python environment configuration for embedded CodeLLDB
- Path sanitization for CodeLLDB installations with spaces on Windows
- Temporary directory management and cleanup

**Adapter Capabilities Tests (L528-574)**:
- Feature support matrix (conditional breakpoints, reverse debugging, etc.)
- Feature requirement specifications by type (version, configuration)
- Default configuration and capability reporting
- Error message translation for common failure scenarios

### Key Testing Patterns

- Extensive use of vitest mocking with `vi.mocked()` for external dependencies
- Platform-specific test isolation using `setPlatform()` helper
- Temporary filesystem operations with proper cleanup
- Environment variable manipulation with restoration
- Mock spy verification for dependency injection validation
- State assertion patterns for adapter lifecycle management

### Platform Coverage

Tests cover Windows (`win32`), Linux, and cross-platform scenarios with particular attention to:
- Windows-specific toolchain issues (MSVC vs GNU, dlltool requirements)  
- Path handling differences (separators, extensions)
- Environment variable conventions per platform
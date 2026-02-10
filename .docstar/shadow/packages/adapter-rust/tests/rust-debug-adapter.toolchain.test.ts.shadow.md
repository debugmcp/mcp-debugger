# packages/adapter-rust/tests/rust-debug-adapter.toolchain.test.ts
@source-hash: 1188b2e27e752851
@generated: 2026-02-10T00:41:31Z

## Purpose

Comprehensive test suite for the RustDebugAdapter class, focusing on toolchain validation, environment setup, binary detection, DAP communication, and platform-specific behavior. Tests the complete lifecycle from toolchain discovery to debug session management.

## Key Test Structures

**Mock Setup (L10-46)**: Extensive mocking of utility modules including rust-utils, codelldb-resolver, binary-detector, and cargo-utils. All external dependencies are mocked to ensure isolated testing.

**Dependencies Factory (L47-79)**: `createDependencies()` creates mock AdapterDependencies with file system, logger, environment, and process launcher mocks.

**Platform Utility (L81-87)**: `setPlatform()` helper for testing platform-specific behavior by temporarily overriding `process.platform`.

## Test Categories

**Executable Resolution (L113-157)**: Tests `resolveExecutablePath()` behavior including caching, fallback logic (cargo → rustc → placeholder), and environment variable handling (`MCP_RUST_ALLOW_PREBUILT`, `MCP_RUST_EXECUTABLE_PLACEHOLDER`).

**Environment Validation (L159-190)**: Tests `validateEnvironment()` including CodeLLDB detection, MSVC toolchain warnings, and GNU toolchain dlltool validation on Windows.

**Command Building (L192-232)**: Tests `buildAdapterCommand()` focusing on environment variable injection (LLDB_USE_NATIVE_PDB_READER, DLLTOOL, PATH modification) and Windows-specific path handling.

**Launch Configuration (L234-306)**: Tests `transformLaunchConfig()` with Cargo project handling including source-to-binary resolution, rebuild detection, and build failure scenarios.

**Toolchain Validation (L308-349)**: Tests binary format detection, MSVC incompatibility handling, and `RUST_MSVC_BEHAVIOR` environment variable effects.

**DAP Operations (L351-417)**: Tests Debug Adapter Protocol communication including event handling, state transitions (DEBUGGING, CONNECTED, DISCONNECTED), error logging, and connection lifecycle.

**Utility Functions (L419-526)**: Tests dependency listing, executable search paths (platform-specific), Python environment configuration, and CodeLLDB path sanitization.

**Capabilities & Messaging (L528-574)**: Tests feature support detection, error message translation, installation guidance, and default configuration provision.

## Key Patterns

- Heavy use of Vitest mocking for external dependencies
- Platform-specific testing with temporary `process.platform` overrides
- Temporary file/directory creation for filesystem tests
- Environment variable manipulation with cleanup
- State transition verification for adapter lifecycle
- Mock function call verification for dependency interaction

## Critical Test Behaviors

- Caching behavior in executable resolution prevents redundant toolchain checks
- Fallback chains ensure graceful degradation when preferred tools unavailable
- Platform-specific path handling for Windows vs. Unix systems
- MSVC toolchain detection and compatibility warnings
- DAP state management and event forwarding
- Python environment isolation for embedded CodeLLDB
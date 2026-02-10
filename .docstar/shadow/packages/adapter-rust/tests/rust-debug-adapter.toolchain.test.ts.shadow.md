# packages/adapter-rust/tests/rust-debug-adapter.toolchain.test.ts
@source-hash: 88d9f2bcff1c183f
@generated: 2026-02-10T21:25:42Z

## Purpose
Comprehensive test suite for `RustDebugAdapter` toolchain logic, covering environment validation, executable resolution, DAP operations, and platform-specific behavior. Tests the adapter's ability to handle Rust compilation, debugging setup, and CodeLLDB integration across different platforms and configurations.

## Test Structure
The test suite is organized around the `RustDebugAdapter` class with mocked dependencies, focusing on toolchain detection and debugging workflow validation.

### Main Test Setup
- **createDependencies** (L47-79): Factory function creating mock `AdapterDependencies` with file system, logger, environment, and process launcher mocks
- **setPlatform** (L81-87): Utility to temporarily mock `process.platform` for cross-platform testing
- **beforeEach** (L93-111): Resets all mocks and environment variables, creates fresh adapter instance

### Key Test Categories

#### Executable Resolution Tests (L113-157)
- **resolveExecutablePath**: Tests caching behavior, preferred executable handling, cargo/rustc fallback logic
- Validates environment variable handling (`MCP_RUST_ALLOW_PREBUILT`, `MCP_RUST_EXECUTABLE_PLACEHOLDER`)
- Tests error handling for missing executables

#### Environment Validation Tests (L159-190)
- **validateEnvironment**: Tests CodeLLDB detection, MSVC toolchain warnings
- Platform-specific validation (Windows GNU toolchain with dlltool checks)
- Integration with utility modules for toolchain detection

#### Build Command Environment Tests (L192-239)
- **buildAdapterCommand**: Tests environment variable injection (LLDB_USE_NATIVE_PDB_READER, DLLTOOL, PATH)
- Windows-specific dlltool path handling
- CodeLLDB executable resolution integration

#### Launch Configuration Tests (L241-313)
- **transformLaunchConfig**: Tests Rust source file to binary resolution
- Cargo project detection and build pipeline integration
- Binary up-to-date checking and rebuild logic
- Build failure error handling

#### Toolchain Validation Tests (L315-356)
- **validateToolchain**: Tests MSVC compatibility detection
- Binary format analysis integration
- Environment variable behavior control (`RUST_MSVC_BEHAVIOR`)
- Toolchain validation result caching and consumption

#### DAP Operations Tests (L358-424)
- Event handling for stopped/terminated debug states
- Exception filter validation and warnings
- Connection lifecycle management
- State transition validation (`AdapterState` enum usage)

#### Utility and Path Tests (L426-533)
- Dependency listing and install command generation
- Platform-specific executable search path generation
- Python environment configuration for embedded CodeLLDB
- Path sanitization for CodeLLDB on Windows (spaces handling)

#### Messaging and Capabilities Tests (L535-581)
- Feature support queries (`DebugFeature` enum)
- Error message translation
- Default configuration and capability reporting

## Key Dependencies
- **Vitest**: Testing framework with mocking capabilities
- **@debugmcp/shared**: Core types (`AdapterError`, `DebugFeature`, `AdapterState`, interfaces)
- **Mocked utilities**: rust-utils, codelldb-resolver, binary-detector, cargo-utils modules
- **Node.js APIs**: fs, path, os for file system operations

## Testing Patterns
- Extensive use of vi.mock() for dependency isolation
- Platform-specific test isolation using setPlatform utility
- Environment variable manipulation with cleanup
- Temporary directory creation for file system tests
- Mock restoration in finally blocks for cleanup

## Platform Considerations
Tests explicitly handle Windows (`win32`) vs Unix platforms for:
- Executable extensions (.exe)
- Path separators and environment variables
- Toolchain-specific behavior (MSVC vs GNU)
- CodeLLDB path handling with spaces
# packages/adapter-rust/tests/rust-utils.test.ts
@source-hash: 5c50520bf39464b1
@generated: 2026-02-10T00:41:26Z

## Purpose
Comprehensive test suite for Rust toolchain utilities in the adapter-rust package. Tests process detection, filesystem operations, and platform-specific binary resolution for Rust development tools.

## Test Structure & Dependencies
- **Vitest framework** (L1): Main testing library with mocking capabilities
- **Mock setup** (L9-22): Mocks `child_process.spawn` and `which` module for isolated testing
- **Cleanup hooks** (L65-76): Resets mocks and cleans up temporary directories between tests

## Key Test Utilities

### createMockProcess (L24-49)
Mock factory for simulating child process behavior with configurable:
- stdout/stderr output streams
- exit codes and error conditions
- Asynchronous event emission via `queueMicrotask`

### createTempDir (L53-57)
Creates temporary directories with automatic cleanup tracking in `tempDirs` array

### overridePlatform (L59-63)
Platform override utility for testing cross-platform behavior, returns restore function

## Test Categories

### Process Detection Tests (L78-149)
- **Cargo installation check** (L79-87): Tests `checkCargoInstallation()` with success/failure scenarios
- **Rustc installation check** (L89-97): Tests `checkRustInstallation()` with version detection
- **Version parsing** (L99-109): Tests `getCargoVersion()` with valid/invalid output formats
- **Project building** (L111-134): Tests `buildRustProject()` capturing both success and failure outputs
- **Host triple detection** (L136-148): Tests `getRustHostTriple()` parsing from rustc output

### Filesystem Operations (L151-174)
- **Project root discovery** (L152-160): Tests `findCargoProjectRoot()` walking directory tree for Cargo.toml
- **Binary path resolution** (L162-173): Tests `getRustBinaryPath()` with platform-specific extensions

### Platform-Specific Tool Detection (L176-214)
- **Environment override** (L177-184): Tests DLLTOOL env var precedence
- **Which fallback** (L186-189): Tests system PATH lookup
- **Windows toolchain scanning** (L191-213): Tests rustup toolchain directory traversal on Windows

## Testing Patterns
- Extensive use of mock implementations to simulate external processes
- Temporary filesystem setup with automatic cleanup
- Platform-specific behavior testing with runtime overrides
- Both positive and negative test cases for robustness validation
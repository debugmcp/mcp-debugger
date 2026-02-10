# tests/adapters/rust/integration/rust-session-smoke.test.ts
@source-hash: 68665fc60213f9f4
@generated: 2026-02-10T00:41:10Z

## Purpose
Integration test file for the Rust adapter that performs smoke testing of session functionality. Tests adapter command building and launch configuration transformation without actually launching processes.

## Key Functions and Structure

**createDependencies() (L8-42)**: Factory function that creates mock AdapterDependencies with stubbed implementations. Key mocks include:
- FileSystem operations all return empty/false values
- Logger methods are no-ops  
- Environment delegates to real process.env
- ProcessLauncher throws error to prevent actual process launches

**Test Suite Setup (L44-74)**: 
- Defines test constants: port 48765, session ID, host 127.0.0.1
- Sets up fake paths for CodeLLDB executable and sample Rust script
- beforeEach/afterEach hooks manage CODELLDB_PATH and RUST_BACKTRACE environment variables

## Test Cases

**Command Building Test (L76-104)**: 
- Verifies RustAdapterFactory creates adapter that builds proper CodeLLDB commands
- Validates command structure: executable path, --port argument, optional --liblldb flag
- Checks environment variables: RUST_BACKTRACE=1, platform-specific LLDB_USE_NATIVE_PDB_READER on Windows

**Launch Config Transformation Test (L106-125)**:
- Tests adapter's ability to normalize binary launch configurations
- Transforms relative program path to absolute path
- Validates output format: type='lldb', sourceLanguages=['rust'], console='internalConsole'
- Uses platform-specific binary names (hello.exe on Windows, hello elsewhere)

## Dependencies
- Vitest testing framework
- RustAdapterFactory from adapter-rust package
- AdapterDependencies type from shared package
- Node.js fs and path modules

## Architectural Notes
- Uses dependency injection pattern with mock dependencies to isolate adapter logic
- Environment variable manipulation ensures clean test isolation
- Platform-aware testing for Windows vs Unix differences
- Integration-level testing without external process dependencies
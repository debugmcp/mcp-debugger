# tests/adapters/rust/integration/
@generated: 2026-02-10T01:19:36Z

## Purpose
Integration test suite for the Rust debugger adapter that validates adapter functionality through smoke testing. This module ensures the Rust adapter correctly builds CodeLLDB commands and transforms launch configurations without requiring actual process launches or external dependencies.

## Key Components and Architecture

**Mock Infrastructure**: The test suite employs a comprehensive dependency injection pattern using `createDependencies()` to provide stubbed implementations of:
- File system operations (all return empty/false values)
- Logger (no-op implementations) 
- Process launcher (throws errors to prevent actual launches)
- Environment access (delegates to real process.env)

**Test Environment Management**: Sophisticated setup/teardown procedures manage:
- Platform-specific environment variables (CODELLDB_PATH, RUST_BACKTRACE)
- Cross-platform binary naming conventions (.exe on Windows)
- Network configuration (test port 48765, localhost)
- Path resolution for CodeLLDB executable and sample Rust programs

## Test Coverage Areas

**Command Building Validation**: Verifies the adapter generates correct CodeLLDB launch commands including:
- Proper executable path resolution
- Port argument configuration (`--port` flag)
- Optional liblldb flags
- Platform-specific environment variables (RUST_BACKTRACE=1, Windows LLDB_USE_NATIVE_PDB_READER)

**Launch Configuration Transformation**: Tests the adapter's ability to:
- Normalize relative program paths to absolute paths
- Transform input configurations to standardized output format
- Set appropriate debugger type ('lldb'), source languages (['rust']), and console mode ('internalConsole')

## Integration Pattern
This directory implements integration testing without external dependencies by:
- Using mock dependencies to isolate adapter logic from system resources
- Testing the complete adapter factory and session creation flow
- Validating cross-platform compatibility through environment-aware testing
- Ensuring proper command generation and configuration transformation end-to-end

## Entry Points
- **rust-session-smoke.test.ts**: Main integration test suite that exercises RustAdapterFactory through mock dependencies and validates both command building and launch configuration transformation workflows

The module serves as a critical validation layer ensuring the Rust adapter integrates correctly with the broader debugger infrastructure while maintaining platform compatibility and proper command generation.
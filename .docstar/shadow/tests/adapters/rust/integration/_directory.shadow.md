# tests/adapters/rust/integration/
@generated: 2026-02-11T23:47:34Z

## Purpose
Integration testing module for the Rust debugging adapter, focusing on smoke tests that verify adapter functionality without launching external processes. This directory contains tests that validate the core adapter behaviors like command building and configuration transformation in an isolated environment.

## Key Components and Organization

**rust-session-smoke.test.ts**: The primary integration test file that performs comprehensive smoke testing of the Rust adapter's session management capabilities. Uses dependency injection with mock implementations to isolate adapter logic from external dependencies.

## Public API Surface

The directory serves as a test validation layer for the Rust adapter's public interface:
- **RustAdapterFactory integration**: Tests the main factory's ability to create properly configured adapters
- **Command building validation**: Verifies CodeLLDB command construction with correct arguments and environment
- **Launch configuration transformation**: Tests the adapter's ability to normalize and transform debugging configurations

## Internal Organization and Data Flow

**Test Infrastructure**:
- `createDependencies()`: Factory function providing mock AdapterDependencies with stubbed FileSystem, Logger, and ProcessLauncher implementations
- Environment variable management with cleanup hooks for CODELLDB_PATH and RUST_BACKTRACE
- Platform-aware testing patterns for Windows vs Unix differences

**Test Flow**:
1. Mock dependencies creation with controlled behavior
2. Adapter instantiation through RustAdapterFactory
3. Command building verification (executable paths, port configuration, environment variables)
4. Launch configuration transformation testing (path normalization, output format validation)

## Important Patterns and Conventions

**Isolation Strategy**: Tests prevent actual process launches while validating adapter logic through dependency mocking. This allows integration-level testing without external dependencies.

**Platform Awareness**: Tests account for platform-specific differences in binary naming (.exe on Windows) and LLDB configuration (LLDB_USE_NATIVE_PDB_READER).

**Environment Management**: Careful setup/teardown of environment variables ensures test isolation and repeatability.

**Configuration Validation**: Tests verify both the structure and content of generated commands and transformed configurations, ensuring compatibility with the underlying CodeLLDB debugger.

This module serves as a critical validation layer ensuring the Rust adapter correctly interfaces with the debugging infrastructure while maintaining isolation from external process dependencies.
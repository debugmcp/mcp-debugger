# tests/adapters/rust/integration/
@generated: 2026-02-10T21:26:20Z

## Purpose
Integration testing directory for the Rust debugger adapter that validates end-to-end functionality without external process dependencies. Provides smoke tests for session management, command building, and launch configuration transformation.

## Key Components

**rust-session-smoke.test.ts**: Comprehensive integration test suite that validates the Rust adapter's core functionality through mocked dependencies. Tests command construction for CodeLLDB and launch configuration normalization.

## Testing Architecture

**Dependency Injection Pattern**: Uses `createDependencies()` factory to provide mock implementations of:
- FileSystem operations (stubbed to return empty/false)
- Logger (no-op implementations)
- Environment access (delegates to real process.env)
- ProcessLauncher (throws to prevent actual launches)

**Test Isolation**: Manages environment variables (CODELLDB_PATH, RUST_BACKTRACE) through beforeEach/afterEach hooks to ensure clean test state.

## Test Coverage Areas

**Command Building Validation**:
- Verifies RustAdapterFactory produces correct CodeLLDB command structure
- Validates executable paths, port arguments, and optional liblldb flags
- Tests environment variable setup (RUST_BACKTRACE=1, platform-specific LLDB settings)

**Launch Configuration Transformation**:
- Tests normalization of binary launch configurations
- Path resolution from relative to absolute
- Platform-aware binary naming (.exe on Windows)
- Output format validation (type='lldb', sourceLanguages=['rust'], console='internalConsole')

## Integration Points

**External Dependencies**:
- RustAdapterFactory from adapter-rust package
- AdapterDependencies type from shared package
- Vitest testing framework
- Node.js built-in modules (fs, path)

**Platform Awareness**: Handles Windows vs Unix differences in binary naming and LLDB configuration flags.

## Testing Philosophy
Smoke testing approach that validates adapter behavior through dependency mocking rather than launching actual debug processes. Ensures integration-level confidence while maintaining fast, reliable test execution without external system dependencies.
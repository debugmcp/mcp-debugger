# tests/adapters/rust/
@generated: 2026-02-10T21:26:32Z

## Purpose
Integration test suite for the Rust debugger adapter that validates end-to-end functionality through controlled mocking. Provides comprehensive smoke testing of the adapter's core capabilities including session management, command construction, and launch configuration handling without requiring external debug processes.

## Key Components

**integration/**: Contains the primary integration test infrastructure that validates the Rust adapter's functionality through dependency injection and mocking patterns.

- **rust-session-smoke.test.ts**: Main integration test suite that exercises the complete adapter workflow from factory creation through command building and launch configuration transformation.

## Testing Architecture

**Dependency Injection Framework**: Employs a sophisticated mocking strategy using `createDependencies()` factory that provides controlled implementations of:
- FileSystem operations (stubbed responses)
- Logger interfaces (no-op implementations) 
- Environment access (selective real/mock delegation)
- ProcessLauncher (controlled failure injection)

**Environment Management**: Robust test isolation through beforeEach/afterEach hooks that manage critical environment variables (CODELLDB_PATH, RUST_BACKTRACE) ensuring clean test state between executions.

## Test Coverage Areas

**Command Building Validation**: Verifies the RustAdapterFactory produces correct CodeLLDB command structures with proper executable paths, port configurations, and platform-specific LLDB flags.

**Launch Configuration Transformation**: Tests the complete pipeline of launch configuration normalization including path resolution, platform-aware binary naming, and output format standardization.

**Platform Compatibility**: Handles Windows vs Unix behavioral differences in binary naming conventions and LLDB configuration requirements.

## Public API Surface

**Primary Entry Point**: Integration tests access the Rust adapter through the `RustAdapterFactory` from the adapter-rust package, validating the public factory interface and configuration transformation methods.

**External Dependencies**: 
- adapter-rust package (primary system under test)
- shared package (AdapterDependencies type definitions)
- Vitest testing framework
- Node.js built-in modules (fs, path)

## Internal Organization

**Smoke Testing Philosophy**: Adopts a strategy of integration-level validation through dependency mocking rather than launching actual debug processes. This approach provides high confidence in adapter behavior while maintaining fast, reliable test execution without external system dependencies.

**Test Isolation Pattern**: Ensures each test runs in a clean environment through systematic setup/teardown of environment variables and mock state, preventing test interference and ensuring reproducible results.
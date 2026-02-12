# tests/adapters/rust/
@generated: 2026-02-11T23:47:45Z

## Purpose
The `tests/adapters/rust` directory provides comprehensive integration testing for the Rust debugging adapter, focusing on validating adapter functionality through controlled smoke tests. This testing module ensures the Rust adapter correctly integrates with the debugging infrastructure while maintaining isolation from external process dependencies through sophisticated mocking strategies.

## Key Components and Organization

**Integration Testing Layer**: The `integration/` subdirectory contains the core testing infrastructure that validates the Rust adapter's session management, command building, and configuration transformation capabilities without launching external processes.

**Primary Test Suite**: `rust-session-smoke.test.ts` serves as the main integration test file, performing comprehensive validation of the RustAdapterFactory and its associated debugging workflows through dependency injection and mock implementations.

## Public API Surface

The directory validates the Rust adapter's public interface across several key areas:

- **Adapter Factory Integration**: Tests RustAdapterFactory's ability to create properly configured debugging adapters
- **Command Construction Validation**: Verifies CodeLLDB command building with correct executable paths, port configurations, and environment variables
- **Configuration Transformation**: Tests launch configuration normalization and transformation for debugging sessions
- **Platform Compatibility**: Validates adapter behavior across Windows and Unix platforms

## Internal Organization and Data Flow

**Test Infrastructure Pattern**:
- `createDependencies()` factory provides controlled mock implementations of AdapterDependencies (FileSystem, Logger, ProcessLauncher)
- Environment variable management with setup/teardown hooks for CODELLDB_PATH and RUST_BACKTRACE
- Platform-aware testing patterns handling Windows vs Unix differences

**Validation Flow**:
1. Mock dependency creation with controlled behavior simulation
2. Adapter instantiation through RustAdapterFactory with injected dependencies
3. Command building verification ensuring proper executable paths and environment setup
4. Launch configuration transformation testing with path normalization and output format validation

## Important Patterns and Conventions

**Isolation-First Testing**: The module employs sophisticated mocking to test integration-level behavior without external dependencies, allowing comprehensive validation of adapter logic while preventing actual process launches.

**Platform-Aware Design**: Tests systematically account for platform-specific differences including binary naming conventions (.exe on Windows) and LLDB configuration parameters (LLDB_USE_NATIVE_PDB_READER).

**Environment Discipline**: Rigorous environment variable management ensures test isolation and repeatability across different execution contexts.

**Behavioral Validation**: Tests verify both structural correctness and content accuracy of generated commands and transformed configurations, ensuring compatibility with the underlying CodeLLDB debugger infrastructure.

This testing directory serves as a critical quality gate ensuring the Rust adapter maintains correct integration patterns with the debugging infrastructure while providing reliable, isolated validation of core adapter functionality.
# tests\adapters\rust\integration/
@generated: 2026-02-12T21:00:53Z

## Overall Purpose and Responsibility

This directory contains integration tests for the Rust debug adapter, focusing on validating the adapter's core functionality without requiring actual process launches or external dependencies. The tests verify that the Rust adapter correctly integrates with the VS Code debug protocol by testing command generation, launch configuration transformation, and environment setup.

## Key Components and Integration

**rust-session-smoke.test.ts**: The primary integration test suite that validates:
- **Command Building**: Ensures the RustAdapterFactory generates proper CodeLLDB commands with correct arguments, ports, and platform-specific flags
- **Launch Configuration Transformation**: Verifies the adapter correctly normalizes and transforms debug launch configurations from relative to absolute paths
- **Environment Management**: Tests proper setup of Rust-specific environment variables (RUST_BACKTRACE, LLDB_USE_NATIVE_PDB_READER)

## Testing Architecture and Patterns

**Dependency Injection with Mocks**: Uses a factory pattern (`createDependencies()`) to inject stubbed implementations of core dependencies:
- FileSystem operations return safe default values
- ProcessLauncher prevents actual process execution
- Logger provides no-op implementations
- Environment delegates to real process.env for authentic testing

**Platform-Aware Testing**: Implements cross-platform test logic that adapts to Windows vs Unix differences in:
- Binary naming conventions (`.exe` suffixes)
- Platform-specific LLDB configuration flags
- Path handling and normalization

## Public API Surface

The integration tests validate the public interface of:
- **RustAdapterFactory**: Main entry point for creating Rust debug adapter instances
- **Adapter Command Building**: Validates the `buildCommand()` method generates proper CodeLLDB invocations
- **Launch Configuration Processing**: Tests the adapter's ability to transform and normalize VS Code launch configurations

## Internal Organization and Data Flow

1. **Test Setup**: Environment variables are managed through beforeEach/afterEach hooks for clean isolation
2. **Mock Dependency Creation**: Factory function provides controlled, predictable implementations of external dependencies
3. **Adapter Instantiation**: RustAdapterFactory creates adapter instances using mock dependencies
4. **Functionality Validation**: Tests verify command generation and configuration transformation without side effects

## Important Patterns and Conventions

- **Smoke Testing Approach**: Tests core functionality without external dependencies or process launches
- **Environment Isolation**: Careful management of environment variables to prevent test interference
- **Cross-Platform Compatibility**: Platform-specific logic ensures tests work on both Windows and Unix systems
- **Integration-Level Focus**: Tests the adapter as a complete unit while avoiding external system dependencies

This testing approach ensures the Rust adapter correctly implements the debug protocol interface while maintaining fast, reliable test execution without requiring external debugger installations or process management.
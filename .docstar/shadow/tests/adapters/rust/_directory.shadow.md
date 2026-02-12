# tests\adapters\rust/
@generated: 2026-02-12T21:01:02Z

## Overall Purpose and Responsibility

This directory contains integration tests for the Rust debug adapter, focusing on validating the adapter's ability to integrate with the VS Code debug protocol without requiring external dependencies or actual process launches. The tests ensure the Rust adapter correctly transforms launch configurations, generates proper debugger commands, and manages environment setup for Rust debugging scenarios.

## Key Components and Integration

**integration/**: Contains the primary integration test suite that validates end-to-end adapter functionality:
- **Command Generation Testing**: Verifies the RustAdapterFactory produces correct CodeLLDB commands with appropriate arguments, ports, and platform-specific configurations
- **Configuration Transformation**: Ensures launch configurations are properly normalized from relative to absolute paths and transformed for debugger consumption
- **Environment Management**: Tests Rust-specific environment variable setup (RUST_BACKTRACE, LLDB_USE_NATIVE_PDB_READER)

## Testing Architecture and Public API Surface

The tests validate the public interface of the Rust adapter through:
- **RustAdapterFactory**: Main entry point for creating Rust debug adapter instances
- **buildCommand() Method**: Core API for generating CodeLLDB debugger invocations
- **Launch Configuration Processing**: Adapter's ability to transform VS Code debug configurations

## Internal Organization and Data Flow

**Dependency Injection Pattern**: Uses a mock factory pattern to inject controlled implementations:
- FileSystem operations return predictable values without file I/O
- ProcessLauncher prevents actual process execution during tests
- Logger provides no-op implementations for clean test output
- Environment delegates to real process.env for authentic variable testing

**Platform-Aware Testing Strategy**: Implements cross-platform logic handling:
- Windows vs Unix binary naming conventions (.exe suffixes)
- Platform-specific LLDB configuration flags
- Path normalization differences across operating systems

## Important Patterns and Conventions

- **Smoke Testing Methodology**: Validates core adapter functionality without external dependencies, ensuring fast and reliable test execution
- **Environment Isolation**: Careful setup/teardown of environment variables prevents test interference
- **Integration-Level Validation**: Tests the complete adapter unit while avoiding external debugger installations
- **Mock-Based Isolation**: Uses dependency injection to eliminate side effects while maintaining realistic testing scenarios

This testing approach ensures the Rust debug adapter correctly implements the VS Code debug protocol interface while maintaining test reliability and cross-platform compatibility without requiring actual debugger processes or file system operations.
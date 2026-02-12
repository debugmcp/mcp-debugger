# tests\adapters\rust\integration/
@generated: 2026-02-12T21:05:39Z

## Purpose
Integration test directory for the Rust debugging adapter that validates core functionality through smoke tests. This module performs end-to-end testing of the Rust adapter's session management, command building, and launch configuration transformation capabilities without spawning actual debugging processes.

## Key Components and Architecture

**Test Infrastructure**:
- **Mock Dependency System**: Comprehensive stubbing of external dependencies (FileSystem, Logger, ProcessLauncher) to isolate adapter logic during testing
- **Environment Management**: Controlled manipulation of environment variables (CODELLDB_PATH, RUST_BACKTRACE) with proper cleanup between tests
- **Platform-Aware Testing**: Cross-platform test execution handling Windows vs Unix differences in binaries and environment variables

**Core Test Scenarios**:
- **Command Building Validation**: Verifies the adapter correctly constructs CodeLLDB debugger commands with proper executable paths, port configurations, and platform-specific flags
- **Launch Configuration Transformation**: Tests the adapter's ability to normalize and transform debugging configurations, including path resolution and output format standardization

## Testing Approach

The integration tests use a **smoke testing strategy** that validates critical paths without external process dependencies:

1. **Dependency Injection Pattern**: Mock implementations prevent actual file system operations and process launches while maintaining realistic test scenarios
2. **Session Lifecycle Testing**: Validates adapter initialization, configuration, and command generation phases
3. **Cross-Platform Validation**: Ensures consistent behavior across Windows and Unix environments with platform-specific assertions

## Key Entry Points

- **createDependencies()**: Factory function for generating mock adapter dependencies
- **RustAdapterFactory Integration**: Primary test target that validates adapter creation and configuration
- **Command and Config Transformation Tests**: Core validation of adapter's debugging setup capabilities

## Testing Patterns

- Uses Vitest framework with beforeEach/afterEach hooks for clean test isolation
- Validates both command structure (executable paths, arguments, flags) and environment setup (RUST_BACKTRACE, LLDB settings)
- Focuses on adapter contract compliance rather than external tool integration
- Maintains separation between adapter logic testing and actual debugging process management
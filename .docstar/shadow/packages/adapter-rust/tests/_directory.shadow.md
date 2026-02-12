# packages\adapter-rust\tests/
@generated: 2026-02-12T21:00:58Z

## Overall Purpose

The `tests` directory provides comprehensive test coverage for the Rust debug adapter package, validating core functionality through unit tests with extensive mocking. This test suite ensures the adapter can properly interface with Rust toolchain components (cargo, rustc, CodeLLDB), handle binary format detection, and manage debug session lifecycles across different platforms.

## Key Components and Architecture

The test suite is organized into five main areas that mirror the adapter's core responsibilities:

### Core Adapter Testing (`rust-adapter.test.ts` & `rust-debug-adapter.toolchain.test.ts`)
- **RustDebugAdapter**: Main adapter class testing covering initialization, capabilities, command building, and launch configuration transformation
- **RustAdapterFactory**: Factory pattern testing for adapter creation and dependency injection
- **Toolchain Integration**: Environment validation, executable resolution, and platform-specific toolchain handling

### Utility Module Testing
- **Binary Detection** (`binary-detector.test.ts`): Tests MSVC vs GNU compiler output detection via binary signatures and debug information
- **Cargo Integration** (`cargo-utils.test.ts`): Tests Rust build system interaction including metadata parsing, target resolution, and build orchestration
- **Rust Toolchain** (`rust-utils.test.ts`): Tests low-level toolchain utilities for process detection, filesystem operations, and platform-specific binary resolution

## Testing Infrastructure and Patterns

### Common Testing Utilities
- **Mock Process Factory**: Simulates child processes with configurable stdout/stderr and exit codes using EventEmitter patterns
- **Temporary Project Builder**: Creates realistic Rust project structures in temp directories with automatic cleanup
- **Platform Override Utilities**: Enables cross-platform testing (Windows vs Unix) with proper restoration
- **Mock Dependency Injection**: Comprehensive mocking of file systems, loggers, environment, and process launchers

### Test Lifecycle Management
- Consistent setup/teardown patterns with `beforeEach`/`afterEach` hooks
- Temporary directory tracking and cleanup to prevent test pollution
- Mock restoration and environment variable reset between tests

## Key Test Coverage Areas

### Integration Testing
- End-to-end build workflows from Rust source to debuggable binaries
- Debug session lifecycle management (connect/disconnect/state transitions)
- Error handling and graceful degradation across failure modes

### Platform-Specific Behavior
- Windows vs Unix executable resolution (.exe extensions)
- MSVC vs GNU toolchain detection and compatibility
- CodeLLDB path handling and environment configuration
- Platform-specific DLL dependencies and debug format support

### Toolchain Validation
- Cargo and rustc installation detection
- Binary format analysis (PDB vs DWARF debug information)
- Rebuild necessity determination via timestamp comparison
- Host triple detection and cross-compilation support

## Public API Testing Surface

The tests validate the adapter's main entry points:
- `RustAdapterFactory.createAdapter()` - Factory method for adapter instantiation
- `RustDebugAdapter.buildAdapterCommand()` - Command construction for CodeLLDB
- `RustDebugAdapter.transformLaunchConfig()` - Launch configuration processing
- `RustDebugAdapter.validateEnvironment()` - Toolchain validation
- Utility functions for cargo operations, binary detection, and toolchain management

## Internal Organization

Tests follow a consistent pattern of:
1. **Isolation**: Extensive mocking to prevent external dependencies
2. **Realism**: Creating actual file structures and binary data for integration testing
3. **Cross-platform**: Platform-specific test branches for Windows/Unix differences
4. **Error Handling**: Both positive and negative test cases for robustness

The test suite ensures the Rust adapter can reliably detect and interface with Rust development tools, handle various binary formats and compilation targets, and provide a stable debugging experience across different platforms and toolchain configurations.
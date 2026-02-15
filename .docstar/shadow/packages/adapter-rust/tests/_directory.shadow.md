# packages\adapter-rust\tests/
@children-hash: 7a64eb8f04b72801
@generated: 2026-02-15T09:01:27Z

## Overall Purpose
The `packages/adapter-rust/tests` directory contains a comprehensive test suite for the Rust debug adapter implementation. This test module validates all aspects of Rust debugging integration including toolchain detection, binary analysis, cargo project management, and CodeLLDB debug adapter orchestration.

## Key Components and Test Coverage

### Core Adapter Testing
- **`rust-adapter.test.ts`**: Tests the main `RustDebugAdapter` and `RustAdapterFactory` classes, covering basic properties, capabilities, command building, launch configuration transformation, and connection management
- **`rust-debug-adapter.toolchain.test.ts`**: Extensive toolchain-specific testing including environment validation, executable resolution, DAP operations, and platform-specific behavior

### Utility Module Testing  
- **`cargo-utils.test.ts`**: Tests Cargo build system integration utilities including project resolution, target discovery, build orchestration, and binary management
- **`rust-utils.test.ts`**: Tests core Rust toolchain utilities for process detection, filesystem operations, and platform-specific binary resolution
- **`binary-detector.test.ts`**: Tests binary format analysis capabilities for distinguishing MSVC vs GNU compiler outputs through signature detection

## Testing Architecture & Patterns

### Mock Infrastructure
All test files employ comprehensive mocking strategies:
- **Process Mocking**: Custom `createMockProcess` factories simulate `child_process.spawn` behavior with configurable stdout/stderr and exit codes
- **Filesystem Mocking**: Temporary directory creation with automatic cleanup tracking
- **Platform Mocking**: Runtime platform override utilities for cross-platform testing
- **Dependency Injection**: Mock `AdapterDependencies` objects isolate units under test

### Test Organization
- **Setup/Teardown**: Consistent `beforeEach`/`afterEach` patterns reset mocks and clean temporary resources
- **Isolated Testing**: Each test file focuses on specific module functionality while maintaining integration test coverage
- **Platform Coverage**: Explicit Windows vs Unix testing for toolchain and binary handling differences

### Data Management
- Temporary directory tracking with force removal cleanup
- Synthetic binary data generation for format detection testing
- Mock cargo metadata JSON responses for realistic project simulation

## Key Integration Points

### Toolchain Validation Flow
Tests validate the complete toolchain detection pipeline:
1. Rust/Cargo installation verification (`rust-utils`)
2. Binary format analysis for MSVC/GNU detection (`binary-detector`) 
3. CodeLLDB compatibility checking (`rust-debug-adapter.toolchain`)
4. Environment variable configuration and path resolution

### Build System Integration
Tests cover end-to-end Cargo project handling:
1. Project root discovery and metadata parsing (`cargo-utils`)
2. Target identification and binary path construction
3. Build orchestration with output capture and error handling
4. Up-to-date checking and rebuild determination

### Debug Adapter Lifecycle
Tests validate complete debug session management:
1. Adapter factory creation and dependency injection
2. Launch configuration transformation for Rust-specific parameters
3. CodeLLDB command building with platform-specific environment setup
4. DAP event handling and state management

## Public API Validation

The test suite validates key adapter interfaces:
- **Factory Pattern**: `RustAdapterFactory.createAdapter()` with proper dependency injection
- **Adapter Interface**: Standard debug adapter methods (connect, disconnect, transformLaunchConfig)
- **Utility Functions**: All exported functions from utils modules with comprehensive input/output validation
- **Error Handling**: Translation and propagation of tool-specific error messages

## Testing Dependencies

- **Vitest**: Primary testing framework with extensive mocking capabilities
- **@debugmcp/shared**: Core debug adapter types and interfaces
- **Node.js APIs**: Filesystem, process, and OS modules for system integration testing

The test suite ensures robust validation of the Rust debug adapter's ability to integrate with the Rust toolchain, manage Cargo projects, analyze compiled binaries, and orchestrate CodeLLDB debugging sessions across different platforms and configurations.
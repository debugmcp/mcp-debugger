# packages/adapter-rust/tests/
@generated: 2026-02-10T21:26:23Z

## Overall Purpose
The `packages/adapter-rust/tests` directory contains a comprehensive test suite for a Rust debug adapter package, providing complete validation coverage for Rust toolchain integration, binary format detection, cargo project management, and debugging functionality. This test suite ensures the adapter can reliably detect, build, and debug Rust applications across different platforms and compiler configurations.

## Key Test Components

### Core Adapter Testing (`rust-adapter.test.ts` & `rust-debug-adapter.toolchain.test.ts`)
- **RustDebugAdapter**: Main adapter class testing covering basic properties, capabilities, command building, launch configuration transformation, and error handling
- **RustAdapterFactory**: Factory pattern testing for adapter instantiation with dependency injection
- **Toolchain Integration**: Environment validation, executable resolution, DAP operations, platform-specific behavior, and MSVC/GNU compatibility detection

### Utility Module Testing
- **Binary Format Detection** (`binary-detector.test.ts`): Tests MSVC vs GNU compiler output detection using binary signatures (RSDS, DWARF debug info, DLL imports)
- **Cargo Operations** (`cargo-utils.test.ts`): Comprehensive testing of Rust build system integration including project resolution, target discovery, build orchestration, and rebuild logic
- **Rust Toolchain Utils** (`rust-utils.test.ts`): Process detection, filesystem operations, version parsing, and platform-specific binary resolution

## Test Architecture & Patterns

### Mock Infrastructure
All test files employ sophisticated mocking strategies:
- **Process Mocking**: Custom `createMockProcess` factories simulate cargo/rustc command execution without system dependencies
- **Filesystem Mocking**: Temporary directory creation with automatic cleanup for isolated test environments  
- **Dependency Injection**: Mock factories for file systems, loggers, environment, and process launchers

### Cross-Platform Testing
Tests explicitly handle platform differences:
- Windows vs Unix executable extensions (.exe)
- Path separators and environment variables
- MSVC vs GNU toolchain detection
- Platform-specific toolchain scanning (rustup directories on Windows)

### Lifecycle Management
Consistent test lifecycle patterns:
- `beforeEach`: Mock resets and environment preparation
- `afterEach`: Temporary directory cleanup and mock restoration
- Comprehensive cleanup strategies to prevent test pollution

## Key Testing Strategies

### Integration Testing Approach
Tests simulate realistic workflows:
- End-to-end build processes from source detection to binary output
- Debug adapter connection/disconnection lifecycle
- Multi-tier fallback strategies for executable resolution
- Error propagation and translation throughout the toolchain

### Validation Coverage
- **Positive Cases**: Successful builds, proper binary detection, valid configurations
- **Error Handling**: Missing executables, malformed configs, build failures, unsupported platforms
- **Edge Cases**: Empty projects, missing files, invalid binary formats

### Data-Driven Testing
Uses synthetic test data and controlled inputs:
- Embedded binary signatures for format detection
- Mock cargo metadata JSON responses
- Configurable process outputs for different scenarios

## Public Test API Surface

### Entry Points
- Adapter functionality validation through `RustDebugAdapter` and `RustAdapterFactory` classes
- Utility function testing for `detectBinaryFormat`, cargo operations, and toolchain detection
- Platform-specific behavior validation across Windows and Unix systems

### Internal Organization
Tests are organized by functional area with clear separation of concerns:
- Adapter core functionality and lifecycle management
- Build system integration and project management  
- Binary format analysis and toolchain detection
- Cross-platform compatibility and environment handling

## Dependencies & Framework Integration
- **Vitest**: Primary testing framework with extensive mocking capabilities
- **@debugmcp/shared**: Core debug adapter types and interfaces
- **Node.js APIs**: File system, child process, and OS utilities for realistic testing
- **Temporary File Management**: Consistent patterns for test isolation and cleanup

This test suite provides comprehensive validation for a production-ready Rust debugging solution, ensuring reliability across diverse development environments and build configurations.
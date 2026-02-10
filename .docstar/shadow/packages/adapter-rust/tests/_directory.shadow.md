# packages/adapter-rust/tests/
@generated: 2026-02-10T01:19:48Z

## Overall Purpose

The `packages/adapter-rust/tests` directory contains comprehensive test suites for the Rust debug adapter implementation. This test module validates the complete functionality of a Language Server Protocol (LSP) debug adapter specifically designed for Rust development, covering toolchain integration, binary analysis, Cargo build system interaction, and Debug Adapter Protocol (DAP) communication.

## Key Components and Relationships

The test suite is organized around five main functional areas that mirror the production code structure:

### Core Adapter Testing (`rust-adapter.test.ts`)
- Tests the main `RustDebugAdapter` class and `RustAdapterFactory`
- Validates basic adapter properties, capabilities, and lifecycle management
- Tests command building, launch configuration transformation, and error handling
- Serves as the primary integration test for the adapter's public API

### Extended Toolchain Testing (`rust-debug-adapter.toolchain.test.ts`) 
- Comprehensive testing of toolchain validation and environment setup
- Tests executable resolution with caching and fallback strategies
- Validates platform-specific behavior (Windows MSVC vs GNU toolchains)
- Tests DAP communication, state transitions, and session management
- Acts as the deep integration test for complex toolchain scenarios

### Utility Module Testing
- **`rust-utils.test.ts`**: Tests core Rust toolchain utilities including process detection, version parsing, and platform-specific tool resolution
- **cargo-utils.test.ts`**: Tests Cargo build system integration including project metadata parsing, target detection, and build orchestration
- **`binary-detector.test.ts`**: Tests binary format analysis for distinguishing MSVC vs GNU compiler outputs

## Public API Test Coverage

The test suite validates the following key entry points:

### Adapter Factory Interface
- `RustAdapterFactory.createAdapter()` - Main factory method for adapter instantiation
- Factory metadata validation (language support, file extensions, display names)
- Environment validation functionality

### Debug Adapter Interface  
- `buildAdapterCommand()` - Command construction for debug session launch
- `transformLaunchConfig()` - Launch configuration processing and validation
- `connect()`/`disconnect()` - Debug session lifecycle management
- `validateEnvironment()` - Toolchain and environment verification
- Capabilities reporting for DAP feature support

### Utility APIs
- Toolchain detection (`checkCargoInstallation`, `checkRustInstallation`)
- Project management (`findCargoProjectRoot`, `resolveCargoProject`)
- Binary analysis (`detectBinaryFormat`, `findBinaryTargets`)
- Build orchestration (`buildCargoProject`, `runCargoBuild`)

## Internal Organization and Data Flow

### Test Infrastructure Pattern
All test files follow a consistent pattern:
1. **Mock Setup**: Comprehensive mocking of external dependencies (file system, child processes, utilities)
2. **Temporary Resources**: Creation and cleanup of temporary directories/files
3. **Platform Abstraction**: Cross-platform testing with runtime platform overrides
4. **Lifecycle Management**: Proper setup/teardown with mock restoration

### Data Flow Testing
Tests validate the complete data flow from:
1. **Environment Discovery** → Toolchain detection and validation
2. **Project Analysis** → Cargo metadata parsing and target identification  
3. **Binary Processing** → Format detection and debug info analysis
4. **Session Management** → DAP communication and state transitions
5. **Build Integration** → Cargo build orchestration and output handling

## Important Patterns and Conventions

### Mock Strategy
- **Process Simulation**: Custom mock factories (`createMockProcess`) simulate child process behavior with configurable outputs and exit codes
- **Dependency Injection**: All external dependencies (filesystem, logger, environment) are mocked through factory functions
- **Async Event Handling**: Uses `queueMicrotask` for proper asynchronous event ordering in mocks

### Platform Testing
- **Runtime Override**: `setPlatform()`/`overridePlatform()` utilities enable testing platform-specific behavior
- **Cross-Platform Validation**: Tests cover Windows-specific toolchain detection, path handling, and binary naming conventions
- **Fallback Chains**: Tests validate graceful degradation across different toolchain configurations

### Resource Management
- **Temporary Isolation**: Each test creates isolated temporary directories with automatic cleanup
- **Mock Restoration**: Consistent pattern of resetting mocks between tests to prevent pollution
- **Error Handling**: Comprehensive testing of both success and failure scenarios for robustness

### Test Data Patterns
- **Synthetic Binary Data**: Uses controlled binary data with embedded signatures to test format detection without requiring actual compiled artifacts
- **Minimal Project Structures**: Creates realistic but minimal Rust project layouts for filesystem-based testing
- **Configurable Mock Responses**: Mock implementations accept configuration for testing various scenarios and edge cases

The test suite ensures the Rust debug adapter can reliably integrate with diverse Rust development environments while maintaining proper isolation and platform compatibility.
# packages\adapter-rust\tests/
@generated: 2026-02-12T21:05:48Z

## Overall Purpose

The `packages/adapter-rust/tests` directory contains comprehensive test suites that validate the Rust debug adapter functionality. This testing module ensures the reliability of Rust debugging integration within the MCP (Model Context Protocol) system through extensive unit tests covering toolchain detection, binary analysis, cargo project management, and debug session orchestration.

## Key Components and Relationships

### Core Test Suites

**Binary Format Detection** (`binary-detector.test.ts`):
- Tests `detectBinaryFormat` utility for distinguishing MSVC vs GNU compiler outputs
- Validates RSDS/PDB detection, DWARF section parsing, and DLL import extraction
- Uses synthetic binary data with embedded signatures for controlled testing

**Cargo Integration** (`cargo-utils.test.ts`):
- Comprehensive testing of Cargo build system utilities including project resolution, target discovery, and build orchestration
- Mocks child processes to test cargo command execution without system dependencies
- Validates metadata parsing, binary target filtering, and rebuild logic

**Rust Adapter Core** (`rust-adapter.test.ts`):
- Tests main `RustDebugAdapter` and `RustAdapterFactory` classes
- Validates debug capabilities, command building, launch configuration transformation, and connection management
- Tests error handling and platform-specific behavior (Windows vs Unix)

**Toolchain Management** (`rust-debug-adapter.toolchain.test.ts`):
- Tests environment validation, executable resolution, and DAP (Debug Adapter Protocol) operations
- Validates CodeLLDB integration, toolchain compatibility detection, and platform-specific tooling
- Covers build pipeline integration and state management

**System Utilities** (`rust-utils.test.ts`):
- Tests Rust toolchain detection (cargo, rustc installation checking)
- Validates filesystem operations for project discovery and binary resolution
- Tests platform-specific tool detection and process management

### Shared Testing Infrastructure

All test suites utilize common patterns:
- **Vitest framework** for mocking and assertions
- **Temporary filesystem management** with automatic cleanup
- **Mock process factory** for simulating cargo/rustc command execution
- **Platform override utilities** for cross-platform testing
- **Dependency injection mocking** for isolated unit testing

## Test Organization and Data Flow

```
Test Execution Flow:
1. Setup Phase: Mock dependencies, create temp directories
2. Execution Phase: Test specific adapter functionality
3. Validation Phase: Assert expected behaviors and outputs  
4. Cleanup Phase: Remove temp files, reset mocks

Component Integration Testing:
binary-detector → cargo-utils → rust-adapter → toolchain validation → system utilities
```

The tests validate the complete debugging workflow from initial toolchain detection through active debug session management, ensuring robust error handling and platform compatibility throughout.

## Key Testing Patterns

### Mock Strategy
- **Child process mocking** for cargo/rustc commands without system dependencies
- **Filesystem mocking** for controlled file operations
- **Platform simulation** for Windows/Unix compatibility testing
- **Environment variable manipulation** with proper cleanup

### Test Data Management
- **Synthetic binary creation** with embedded signatures (PE headers, debug markers)
- **Temporary Rust project generation** with minimal Cargo.toml/main.rs structures
- **Mock JSON metadata** simulating cargo command outputs
- **Controlled error scenarios** for failure path validation

### Coverage Areas
- **Positive path testing**: Normal operation validation
- **Error handling**: Graceful degradation and meaningful error messages
- **Platform compatibility**: Windows (.exe handling, MSVC toolchain) vs Unix behavior
- **Environment resilience**: Missing tools, malformed configs, permission issues
- **State management**: Debug session lifecycle and adapter state transitions

## Integration Points

The test suite validates integration between:
- **Cargo build system** and debug adapter configuration
- **Binary format detection** and toolchain compatibility
- **CodeLLDB debugger** and Rust-specific debugging features  
- **Platform-specific tooling** (dlltool, MSVC detection) and cross-platform operation
- **File system operations** and temporary resource management

This comprehensive testing ensures the Rust debug adapter can reliably handle diverse development environments, project configurations, and debugging scenarios while maintaining consistent behavior across platforms.
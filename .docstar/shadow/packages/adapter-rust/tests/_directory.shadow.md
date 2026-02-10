# packages/adapter-rust/tests/
@generated: 2026-02-09T18:16:17Z

## Overall Purpose
Comprehensive test suite for the adapter-rust package, providing complete coverage of Rust debugging adapter functionality, toolchain management, binary format detection, and Cargo project integration within the DebugMCP ecosystem.

## Key Components and Architecture

### Core Test Modules

**rust-adapter.test.ts**: Primary test suite for the `RustDebugAdapter` class, covering:
- Adapter initialization and capability reporting
- Debug configuration transformation and validation
- Connection lifecycle management and state transitions
- CodeLLDB command construction and TCP mode configuration

**rust-debug-adapter.toolchain.test.ts**: Integration-focused testing for:
- Toolchain detection and environment validation
- DAP (Debug Adapter Protocol) operations and event handling
- Platform-specific configurations (Windows MSVC vs GNU toolchain)
- Build system integration and executable resolution

**rust-adapter-factory.test.ts**: Factory pattern testing for adapter creation and metadata provision

### Utility Test Modules

**cargo-utils.test.ts**: Validates Cargo project interaction utilities:
- Project metadata parsing and target discovery
- Build execution and test running
- Binary target filtering and name resolution
- Rebuild necessity detection based on file modification times

**rust-utils.test.ts**: Tests foundational Rust toolchain operations:
- Cargo/rustc installation detection and version parsing
- Project building and host triple extraction
- Dlltool discovery for Windows GNU toolchain support
- Filesystem helpers for project root and binary path resolution

**binary-detector.test.ts**: Validates binary format detection functionality:
- MSVC vs GNU binary format identification
- Debug information extraction (PDB, DWARF)
- Import library analysis and signature detection

## Test Infrastructure Patterns

### Mock Architecture
- **Process Mocking**: Comprehensive `child_process.spawn` mocking using Vitest for all external tool interactions
- **Filesystem Simulation**: Mock file system operations with temporary directory management and automatic cleanup
- **Platform Abstraction**: Cross-platform testing with `process.platform` override capabilities
- **Dependency Injection**: Mock `AdapterDependencies` providing logger, environment, and process launcher abstractions

### Test Isolation
- **Temporary Directories**: Each test creates isolated temporary workspaces with automatic cleanup
- **Mock Restoration**: Systematic mock reset between tests to prevent state leakage
- **Environment Sandboxing**: Environment variable manipulation with restoration guarantees

### Cross-Platform Coverage
Platform-specific testing for Windows, Linux, and macOS scenarios including:
- Windows MSVC vs GNU toolchain compatibility
- Executable extension handling (.exe on Windows)
- Path separator and environment variable conventions
- Platform-specific tool discovery mechanisms

## Public API Testing Surface

### Primary Entry Points
- **RustDebugAdapter**: Main adapter class with initialization, configuration transformation, and connection management
- **RustAdapterFactory**: Factory for adapter creation with metadata and environment validation
- **Cargo Utils**: Project resolution, building, testing, and target discovery
- **Rust Utils**: Toolchain detection, version parsing, and project building
- **Binary Detector**: Format detection and debug information extraction

### Key Capabilities Validated
- **Debugging Features**: Conditional breakpoints, function breakpoints, data breakpoints, disassembly support
- **Configuration Handling**: Launch config transformation, CodeLLDB command construction, TCP port management
- **Toolchain Integration**: Cargo project detection, binary resolution, rebuild optimization
- **Platform Support**: Windows PDB reader configuration, GNU dlltool validation, MSVC behavior modes

## Data Flow and Integration

Tests validate the complete debugging workflow:
1. **Project Discovery**: Cargo.toml detection and project metadata parsing
2. **Toolchain Validation**: Rust/Cargo installation checks and version compatibility
3. **Build Management**: Incremental rebuild detection and cargo build execution
4. **Binary Analysis**: Format detection and debug information extraction
5. **Adapter Configuration**: CodeLLDB command construction and DAP setup
6. **Debug Session**: Connection lifecycle, event handling, and state management

## Testing Conventions

- **Synthetic Data**: Tests use mock binaries with recognizable signatures rather than real executables for predictable, lightweight validation
- **Error Path Coverage**: Comprehensive testing of failure scenarios including missing tools, build failures, and malformed configurations
- **Async/Await Patterns**: All file operations and process interactions use Promise-based async patterns
- **Type Safety**: TypeScript with proper typing for mock objects and test assertions
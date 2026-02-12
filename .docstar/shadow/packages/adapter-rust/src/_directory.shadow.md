# packages/adapter-rust/src/
@generated: 2026-02-11T23:48:07Z

## Rust Debug Adapter Package

The `adapter-rust` source directory provides a complete Rust debugging solution for the MCP (Model Context Protocol) Debugger framework. It implements a production-ready debug adapter that bridges Rust development workflows with Visual Studio Code's Debug Adapter Protocol (DAP) through the CodeLLDB debugger backend.

## Architecture & Key Components

### Core Entry Point
**index.ts** - Public API surface exposing all package functionality:
- `RustDebugAdapter` - Main debug adapter implementation
- `RustAdapterFactory` - Factory for adapter instantiation with validation
- Utility functions for CodeLLDB resolution, Cargo operations, and binary analysis
- TypeScript type definitions for consumer integration

### Implementation Layers

**RustDebugAdapter** (`rust-debug-adapter.ts`) - Core adapter implementation:
- State machine managing lifecycle: UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING
- Proxy-based architecture delegating DAP communication to ProxyManager
- Comprehensive environment validation and toolchain compatibility checking
- Launch configuration transformation from Rust sources to debuggable binaries
- Platform-specific handling for Windows MSVC/GNU toolchain differences

**RustAdapterFactory** (`rust-adapter-factory.ts`) - Dependency injection and validation:
- Factory pattern implementation for clean adapter instantiation
- Environment prerequisite validation (CodeLLDB, Cargo, Rust toolchain)
- Metadata provision for MCP framework integration
- Graceful degradation with warnings for optional dependencies

### Utility Infrastructure (`utils/`)
**Comprehensive Rust ecosystem integration** providing:
- **Toolchain Management**: Rust/Cargo installation detection and version checking
- **Project Operations**: Cargo.toml parsing, build orchestration, and target resolution
- **Binary Analysis**: Executable format detection, debug info classification, MSVC vs GNU identification
- **Debug Tool Integration**: CodeLLDB executable resolution with multi-path fallback strategies
- **Platform Abstraction**: Windows, macOS, and Linux compatibility with OS-specific optimizations

## Data Flow & Integration

1. **Initialization**: Factory validates environment prerequisites (CodeLLDB availability, Rust toolchain)
2. **Adapter Creation**: Factory instantiates RustDebugAdapter with validated dependencies
3. **Launch Preparation**: Adapter resolves source files to binaries via Cargo integration
4. **Debug Session**: Proxy architecture manages CodeLLDB subprocess and DAP communication
5. **State Management**: Event-driven state transitions with comprehensive error handling

## Public API Surface

**Primary Exports**:
- `RustDebugAdapter` - Debug adapter implementing IDebugAdapter interface
- `RustAdapterFactory` - Factory implementing IAdapterFactory for MCP integration
- `resolveCodeLLDBPath`, `checkCargoInstallation` - Environment validation utilities
- `resolveCargoProject`, `getCargoTargets` - Cargo workspace management
- `detectBinaryFormat` - Binary analysis for toolchain compatibility
- `BinaryInfo` type - Metadata structure for executable analysis

**Configuration Interface**:
- `RustLaunchConfig` - Extends DAP with Rust-specific options (Cargo targets, features, LLDB commands)
- Source mapping support for standard library debugging
- Flexible build configuration (bin/example/test targets, release/debug modes)

## Key Design Patterns

- **Factory Pattern**: Clean separation of adapter creation from configuration
- **Proxy Architecture**: CodeLLDB subprocess management with DAP passthrough
- **Dependency Injection**: Testable design with external dependency provision
- **Graceful Degradation**: Warnings for missing optional tools, errors only for critical dependencies
- **Platform Awareness**: Windows MSVC/GNU toolchain compatibility with configurable behavior
- **Caching Strategy**: 60-second TTL for executable resolution to optimize performance

## Integration Points

- **MCP Framework**: Implements standard IDebugAdapter and IAdapterFactory interfaces
- **CodeLLDB Backend**: Leverages LLDB debugging capabilities through TCP-mode communication
- **Cargo Build System**: Deep integration with Rust's build system for binary resolution
- **VS Code DAP**: Full Debug Adapter Protocol compliance for editor integration
- **Cross-Platform Tooling**: Handles Windows dlltool, RUSTUP_HOME/CARGO_HOME environments

## Critical Dependencies

- **CodeLLDB**: Mandatory LLDB-based debugger backend for Rust debugging
- **Rust Toolchain**: cargo and rustc for project building and metadata
- **Node.js Built-ins**: child_process, fs/promises for system integration
- **Platform Tools**: Windows-specific dlltool for GNU toolchain support

This package serves as a complete Rust debugging solution, handling the complexity of Rust toolchain integration while providing a clean, standards-compliant interface for MCP-based debugging workflows.
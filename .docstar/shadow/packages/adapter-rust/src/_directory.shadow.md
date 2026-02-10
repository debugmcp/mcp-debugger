# packages/adapter-rust/src/
@generated: 2026-02-10T01:20:06Z

## Rust Debug Adapter Package

This directory implements a complete Rust debugging solution for the MCP (Model Context Protocol) debugger framework, providing seamless integration between Rust development workflows and CodeLLDB debugging capabilities.

## Overall Purpose and Responsibility

The `adapter-rust` package serves as a language-specific debugging adapter that bridges Rust development environments with the MCP debugger ecosystem. It handles the complete debugging lifecycle from project discovery and build orchestration to debug session management and binary analysis. The adapter abstracts away the complexities of Rust toolchain integration, Cargo project management, and CodeLLDB configuration to provide a unified debugging experience.

## Key Components and Architecture

**Core Adapter Layer**:
- `RustDebugAdapter` - Primary debug adapter implementing `IDebugAdapter` interface with state machine management (UNINITIALIZED → READY → CONNECTED → DEBUGGING)
- `RustAdapterFactory` - Factory pattern implementation for adapter instantiation and environment validation
- Proxy-based architecture where the adapter coordinates with CodeLLDB through DAP (Debug Adapter Protocol) communication

**Infrastructure Layer (`utils/`)**:
- **Toolchain Management** (`rust-utils.ts`) - Rust/Cargo environment validation and binary path resolution
- **Project Operations** (`cargo-utils.ts`) - Cargo project discovery, building, testing, and metadata extraction
- **Binary Analysis** (`binary-detector.ts`) - Compiled binary format detection (MSVC vs GNU, PDB vs DWARF)
- **Debug Integration** (`codelldb-resolver.ts`) - CodeLLDB executable resolution across deployment scenarios

## Data Flow and Component Integration

1. **Environment Validation**: Factory validates CodeLLDB availability, Rust toolchain, and platform compatibility
2. **Project Discovery**: Cargo utilities locate project roots and parse Cargo.toml configurations
3. **Build Orchestration**: Intelligent rebuild detection and cargo command execution with progress tracking
4. **Binary Analysis**: Post-build toolchain classification determines debug configuration requirements
5. **Debug Session**: Adapter spawns CodeLLDB in TCP mode, manages DAP communication, and handles Rust-specific debugging features

## Public API Surface

**Main Entry Points** (`index.ts`):
- `RustDebugAdapter` - Core debug adapter class
- `RustAdapterFactory` - Factory for adapter creation and validation
- `resolveCodeLLDBPath`, `checkCargoInstallation` - Environment setup utilities
- `resolveCargoProject`, `getCargoTargets` - Project management functions
- `detectBinaryFormat`, `BinaryInfo` - Binary analysis capabilities

**Configuration Interface**:
- `RustLaunchConfig` - Extends base launch configuration with Rust-specific options (cargo targets, build modes, LLDB commands, source mapping)
- Supports debugging of binaries, examples, tests, and benchmarks
- Configurable MSVC/GNU toolchain compatibility handling

## Key Features and Capabilities

**Rust-Specific Debugging**:
- Automatic source-to-binary resolution through Cargo integration
- Support for all Cargo target types (bin, example, test, bench)
- Rust panic handling and exception breakpoint configuration
- Standard library source mapping for deep debugging

**Platform and Toolchain Compatibility**:
- Cross-platform CodeLLDB resolution (Windows/macOS/Linux)
- MSVC vs GNU toolchain detection with compatibility warnings
- Windows-specific PDB reader configuration and dlltool integration
- Containerized environment support via relaxed mode

**Development Workflow Integration**:
- Intelligent rebuild detection minimizes compilation overhead
- Comprehensive error translation with installation guidance
- Cargo feature flag and build profile support
- Embedded Python environment configuration for LLDB visualizers

## Architectural Patterns

**Factory Pattern**: Clean separation of adapter creation from configuration and validation logic
**Proxy Architecture**: Delegates actual debugging to CodeLLDB while managing Rust-specific concerns
**State Machine**: Explicit adapter lifecycle management with proper error handling and cleanup
**Caching Strategy**: Executable path caching with TTL for performance optimization
**Graceful Degradation**: Robust fallback chains handle missing dependencies and varied deployment scenarios

This package represents a comprehensive solution for Rust debugging within the MCP framework, handling the full spectrum from environment setup through active debugging sessions while maintaining platform compatibility and developer workflow integration.
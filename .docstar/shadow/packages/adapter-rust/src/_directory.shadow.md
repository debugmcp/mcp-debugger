# packages/adapter-rust/src/
@generated: 2026-02-10T21:26:51Z

## Overall Purpose and Responsibility

The `packages/adapter-rust/src` directory implements a complete Rust debugging solution for the MCP Debugger framework. It provides a specialized debug adapter that integrates CodeLLDB (LLVM debugger) with Rust development workflows, enabling seamless debugging of Rust applications through the Debug Adapter Protocol (DAP). The module handles the full lifecycle from environment validation and project discovery to binary compilation and debug session management.

## Key Components and Architecture

The directory follows a layered architecture with clear separation of concerns:

### Core Adapter Layer
- **`rust-debug-adapter.ts`**: Main debug adapter implementation extending EventEmitter and implementing IDebugAdapter. Manages state transitions (UNINITIALIZED → READY → CONNECTED → DEBUGGING), handles DAP communication through ProxyManager, and provides Rust-specific debugging capabilities.
- **`rust-adapter-factory.ts`**: Factory pattern implementation for creating adapter instances and performing comprehensive environment validation. Implements dependency injection and provides metadata about adapter capabilities.

### Utility Foundation (`utils/` directory)
- **`cargo-utils.ts`**: Cargo project management (project discovery, metadata extraction, build orchestration)
- **`rust-utils.ts`**: Rust toolchain validation (Cargo/rustc availability, version detection, platform-specific configuration)
- **`binary-detector.ts`**: Executable format analysis (MSVC vs GNU detection, debug format identification)
- **`codelldb-resolver.ts`**: CodeLLDB debugger integration (executable resolution, version management)

### Public API Surface (`index.ts`)
Unified entry point exposing all public interfaces for external consumption.

## Data Flow and Component Integration

The components work together in a structured pipeline:

1. **Validation Phase**: `RustAdapterFactory` uses `rust-utils` and `codelldb-resolver` to validate the debugging environment
2. **Project Discovery**: `cargo-utils` identifies Rust projects and extracts build metadata
3. **Compilation**: Build orchestration through Cargo with intelligent change detection
4. **Binary Analysis**: `binary-detector` analyzes compiled executables for toolchain compatibility
5. **Debug Session**: `RustDebugAdapter` launches CodeLLDB and manages DAP communication

## Public API Surface

### Main Entry Points
- **`RustDebugAdapter`**: Core debug adapter class for direct instantiation
- **`RustAdapterFactory`**: Recommended factory pattern entry point with built-in validation
- **`resolveCodeLLDBPath`** / **`resolveCodeLLDBExecutable`**: CodeLLDB debugger resolution utilities
- **`checkCargoInstallation`**: Rust toolchain validation
- **`resolveCargoProject`** / **`getCargoTargets`**: Cargo workspace management
- **`detectBinaryFormat`**: Binary analysis for toolchain compatibility

### Key Interfaces
- **`RustLaunchConfig`**: Rust-specific debug configuration extending base launch config
- **`BinaryInfo`**: Binary metadata structure for executable analysis
- **`ToolchainValidationResult`**: MSVC/GNU compatibility validation results

## Internal Organization and Patterns

### State Management
The adapter implements a robust state machine with proper lifecycle management, connection handling, and error recovery. Executable path caching (60-second TTL) optimizes performance for repeated operations.

### Cross-Platform Support
Extensive platform-aware logic handles Windows (MSVC vs GNU toolchains), macOS, and Linux variations. Special handling for Windows includes native PDB reader configuration and dlltool path management.

### Error Handling
Comprehensive error translation provides actionable guidance for common Rust/CodeLLDB issues, with graceful degradation and fallback mechanisms throughout the utility layer.

### Configuration Management
Supports flexible debugging configurations including Cargo build options (bin/example/test targets, features, release mode), LLDB customization, and source mapping for standard library debugging.

### Environment Adaptability
Includes relaxed mode for containerized environments and configurable MSVC behavior strategies, ensuring broad deployment compatibility while maintaining debugging effectiveness.

The module serves as a complete bridge between Rust development tooling and the MCP debugging ecosystem, providing production-ready debugging capabilities with enterprise-grade reliability and cross-platform compatibility.
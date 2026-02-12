# packages\adapter-rust\src/
@generated: 2026-02-12T21:01:18Z

## Rust Debug Adapter Package

**Overall Purpose**: Complete Rust debugging integration for the MCP Debugger framework, providing a comprehensive adapter that bridges Rust/Cargo development environments with CodeLLDB debugging capabilities through the Debug Adapter Protocol (DAP).

## Key Components and Integration

### Core Architecture
The package follows a layered architecture with clear separation of concerns:

**Entry Layer (`index.ts`)**: Unified public API exposing all components through a single import point
- Exports the complete debugging toolkit including adapters, factories, and utilities
- Provides clean abstraction for consumers integrating Rust debugging capabilities

**Factory Layer (`rust-adapter-factory.ts`)**: Implements the factory pattern for adapter lifecycle management
- `RustAdapterFactory`: Creates adapter instances with dependency injection
- Comprehensive environment validation checking CodeLLDB availability, Cargo installation, and toolchain compatibility
- Returns structured validation results with errors, warnings, and environment details

**Adapter Layer (`rust-debug-adapter.ts`)**: Core debugging implementation extending EventEmitter and implementing IDebugAdapter
- Manages complete debug session lifecycle through state machine transitions
- Handles Rust-specific configuration transformation and executable resolution
- Provides CodeLLDB proxy management with TCP-mode communication
- Implements platform-aware toolchain validation (MSVC vs GNU)

**Utilities Layer (`utils/`)**: Foundational support infrastructure
- Rust/Cargo environment detection and validation
- Cargo project management and build operations
- Binary format analysis for debugging strategy selection
- Platform-specific CodeLLDB executable resolution

### Data Flow and Component Interaction

```
Environment Validation → Project Discovery → Build Management → Debug Session
```

1. **Environment Setup**: Factory validates Rust toolchain, Cargo installation, and CodeLLDB availability
2. **Adapter Creation**: Factory instantiates RustDebugAdapter with validated dependencies
3. **Project Resolution**: Adapter uses cargo-utils to discover projects, targets, and manage builds
4. **Binary Analysis**: binary-detector classifies executables for optimal debugging strategy
5. **Debug Initialization**: codelldb-resolver provides platform-specific debugger executable
6. **Session Management**: Adapter manages DAP protocol communication through ProxyManager

## Public API Surface

### Main Entry Points
- `RustDebugAdapter`: Core adapter class for debug session management
- `RustAdapterFactory`: Factory for creating and validating adapter instances
- `resolveCodeLLDBPath()` / `resolveCodeLLDBExecutable()`: CodeLLDB infrastructure setup
- `checkCargoInstallation()` / `checkRustInstallation()`: Environment validation
- `resolveCargoProject()` / `getCargoTargets()`: Cargo project management
- `detectBinaryFormat()`: Binary analysis for debugging compatibility

### Key Interfaces and Types
- `RustLaunchConfig`: Rust-specific debugging configuration extending base DAP config
- `BinaryInfo`: Binary classification results (MSVC/GNU, debug info presence)
- `CargoTarget`: Representation of Cargo compilation targets
- `ToolchainValidationResult`: Compatibility assessment for debugging requirements

## Internal Organization

### State Management
- Adapter implements state machine: UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING
- Executable path caching with 60-second TTL for performance optimization
- Thread tracking and DAP event handling for session management

### Platform Considerations
- Windows MSVC vs GNU toolchain detection and compatibility warnings
- Cross-platform CodeLLDB executable resolution with multiple fallback paths
- Platform-specific binary format analysis and debug symbol detection

### Error Handling and Resilience
- Graceful degradation with fallback mechanisms throughout the stack
- Comprehensive error translation for common Rust/CodeLLDB issues
- Installation guidance and troubleshooting for environment setup failures

## Critical Dependencies

**External Tools**: CodeLLDB (mandatory), Cargo (recommended), Rust toolchain
**Internal Dependencies**: `@debugmcp/shared` interfaces, ProxyManager for DAP communication
**Environment Variables**: Supports `MCP_RUST_ALLOW_PREBUILT` for containerized environments

## Key Patterns and Conventions

- **Factory Pattern**: Clean separation of adapter creation from configuration
- **Proxy Architecture**: CodeLLDB process management through ProxyManager abstraction
- **Validation-First Design**: Comprehensive environment checking before adapter creation
- **Caching Strategy**: Performance optimization through intelligent path and build artifact caching
- **Platform Awareness**: Handles Windows/Linux/macOS differences in toolchain and executable resolution

This package provides a production-ready solution for Rust debugging within MCP-based development environments, emphasizing reliability, platform compatibility, and developer experience through comprehensive toolchain integration.
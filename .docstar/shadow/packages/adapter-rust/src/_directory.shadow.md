# packages\adapter-rust\src/
@children-hash: a6e487a6a814d6d7
@generated: 2026-02-15T09:01:53Z

## Rust Debug Adapter Package

This directory implements a complete Rust debugging solution for the MCP (Model Context Protocol) debugger framework, providing comprehensive integration with the Rust ecosystem through CodeLLDB as the underlying debug engine.

## Overall Purpose and Responsibility

The adapter-rust package serves as a language-specific debug adapter that bridges Rust development workflows with standardized debugging protocols. It handles the complete debugging lifecycle from environment validation and project discovery to executable analysis and debug session management. The adapter abstracts away Rust toolchain complexity while providing robust cross-platform debugging capabilities for Rust applications.

## Key Components and Architecture

### Core Components

**`index.ts`** - Public API surface and entry point
- Exports all public interfaces including `RustDebugAdapter`, `RustAdapterFactory`, and utility functions
- Provides unified access to the complete Rust debugging capability set

**`rust-adapter-factory.ts`** - Factory and validation layer
- Implements `IAdapterFactory` pattern for clean dependency injection
- Performs comprehensive environment validation (CodeLLDB availability, Cargo installation, toolchain compatibility)
- Handles Windows MSVC vs GNU toolchain detection and warnings

**`rust-debug-adapter.ts`** - Core adapter implementation
- Extends EventEmitter with IDebugAdapter interface compliance
- Manages adapter state machine: UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING
- Orchestrates executable resolution, toolchain validation, and CodeLLDB command generation
- Handles DAP (Debug Adapter Protocol) operations with Rust-specific customizations

**`utils/`** - Specialized utility modules providing:
- **Toolchain Integration** (`rust-utils.ts`): Rust/Cargo installation detection and version management
- **Project Management** (`cargo-utils.ts`): Cargo workspace resolution, building, and target discovery
- **Binary Analysis** (`binary-detector.ts`): Executable format detection and debug information scanning
- **Debug Environment** (`codelldb-resolver.ts`): CodeLLDB path resolution and version compatibility

### Component Relationships

The architecture follows a layered dependency model:

1. **Factory Layer** validates environment and creates adapter instances
2. **Adapter Layer** orchestrates debugging sessions and manages state
3. **Utility Layer** provides specialized Rust ecosystem integration
4. **Debug Engine** (CodeLLDB) handles low-level debugging operations

Data flows from project discovery through build validation to debug session establishment, with each layer handling specific concerns while maintaining clean interfaces.

## Public API Surface

### Main Entry Points

**Core Classes**
- `RustDebugAdapter`: Primary debug adapter implementation with full DAP compliance
- `RustAdapterFactory`: Factory for adapter creation and environment validation

**Utility Functions**
- `resolveCodeLLDBPath()`, `resolveCodeLLDBExecutable()`: Debug engine path resolution
- `checkCargoInstallation()`: Rust toolchain validation
- `resolveCargoProject()`, `getCargoTargets()`: Project discovery and metadata extraction
- `detectBinaryFormat()`: Binary analysis for toolchain compatibility

**Type Definitions**
- `BinaryInfo`: Structured binary metadata interface
- `RustLaunchConfig`: Rust-specific debugging configuration

### Integration Patterns

**Environment Validation Workflow**
1. Factory validates CodeLLDB availability (mandatory)
2. Checks Cargo installation (recommended with warnings)
3. Detects toolchain compatibility (MSVC vs GNU on Windows)
4. Returns structured validation results with errors/warnings

**Debug Session Lifecycle**
1. Adapter resolves source files to compiled binaries
2. Performs toolchain compatibility validation
3. Builds CodeLLDB command with TCP mode configuration
4. Manages DAP communication through ProxyManager
5. Handles Rust-specific debugging features (panic breakpoints, source mapping)

## Internal Organization and Data Flow

### State Management
- Comprehensive adapter state tracking with proper lifecycle transitions
- Executable path caching with 60-second TTL for performance
- Thread tracking and DAP event handling for debugging context

### Cross-Platform Support
- Windows-specific MSVC vs GNU toolchain handling
- Platform-aware executable resolution and path management
- Architecture-specific debugging tool configuration

### Error Handling and Resilience
- Graceful degradation with multiple fallback strategies
- Comprehensive error translation for common Rust/CodeLLDB issues
- Environment-specific installation guidance and troubleshooting

### Performance Optimizations
- Intelligent rebuild detection using file modification timestamps
- Limited binary scanning for format classification
- Caching of resolved paths and toolchain metadata

## Important Patterns and Conventions

**Factory Pattern**: Clean separation between adapter creation and configuration, enabling dependency injection and testability

**Proxy Architecture**: Delegates low-level DAP communication to ProxyManager while maintaining Rust-specific customizations

**Environment Flexibility**: Supports containerized environments through relaxed mode configurations (`MCP_RUST_ALLOW_PREBUILT`)

**Comprehensive Validation**: Multi-layered validation from factory-level environment checking to runtime toolchain compatibility verification

This package provides a complete, production-ready Rust debugging solution that integrates seamlessly with the MCP debugger ecosystem while handling the full complexity of Rust toolchain management and cross-platform debugging requirements.
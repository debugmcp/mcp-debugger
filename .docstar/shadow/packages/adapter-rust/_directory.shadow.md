# packages/adapter-rust/
@generated: 2026-02-11T23:48:26Z

## Rust Debug Adapter Package

The `adapter-rust` package provides a complete Rust debugging solution for the MCP (Model Context Protocol) Debugger framework. It implements a production-ready debug adapter that bridges Rust development workflows with Visual Studio Code's Debug Adapter Protocol (DAP) through the CodeLLDB debugger backend.

## Overall Architecture

This package follows a multi-layered architecture combining external tool vendoring, comprehensive Rust ecosystem integration, and standards-compliant debugging protocol implementation. The system transforms Rust source code into debuggable binaries and manages the complete debugging session lifecycle.

### Component Integration Flow

1. **Build Automation** (`scripts/`) - Downloads and caches CodeLLDB debugger binaries across platforms
2. **Core Implementation** (`src/`) - Provides the main debug adapter and factory implementations
3. **Utility Infrastructure** (`src/utils/`) - Handles Rust toolchain integration, binary analysis, and platform abstraction
4. **Test Coverage** (`tests/`) - Validates all components through comprehensive unit and integration testing

## Key Components & Relationships

### **External Tool Management**
The `scripts/` directory handles the complex vendoring of CodeLLDB debugger binaries, automatically downloading platform-specific VSIX packages and organizing debugging tools across Windows, macOS, and Linux (x64/ARM64). This creates the foundation for cross-platform Rust debugging by ensuring consistent debugger availability.

### **Debug Adapter Core**
The `src/` directory implements the primary debugging interfaces:
- **RustDebugAdapter** - Main state machine managing the debugging lifecycle with proxy-based DAP communication
- **RustAdapterFactory** - Dependency injection and environment validation ensuring all prerequisites are met
- **Comprehensive utilities** - Deep Rust ecosystem integration handling Cargo builds, binary analysis, and toolchain management

### **Testing Infrastructure** 
The `tests/` directory provides extensive validation coverage with sophisticated mocking infrastructure, testing everything from Cargo integration to binary format detection across different platforms and toolchain configurations.

## Public API Surface

### Primary Entry Points
- **`RustDebugAdapter`** - Core debug adapter implementing `IDebugAdapter` interface for MCP integration
- **`RustAdapterFactory`** - Factory implementing `IAdapterFactory` for clean adapter instantiation with validation
- **Environment validation utilities** - `resolveCodeLLDBPath()`, `checkCargoInstallation()` for prerequisite checking
- **Cargo integration functions** - `resolveCargoProject()`, `getCargoTargets()` for build system interaction
- **Binary analysis tools** - `detectBinaryFormat()` for toolchain compatibility detection

### Configuration Interface
- **`RustLaunchConfig`** - Extends DAP with Rust-specific options (Cargo targets, build features, LLDB commands)
- **`BinaryInfo`** - Metadata structure providing executable analysis results
- **Platform-specific handling** - Automatic MSVC vs GNU toolchain detection and configuration

## Internal Organization & Data Flow

### Debugging Session Lifecycle
1. **Environment Validation** - Factory validates CodeLLDB availability and Rust toolchain presence
2. **Project Analysis** - Cargo metadata parsing and binary target identification
3. **Build Orchestration** - Intelligent rebuilding based on file timestamps and dependencies  
4. **Binary Classification** - Debug format detection and toolchain compatibility checking
5. **Debug Session Management** - CodeLLDB subprocess orchestration with DAP passthrough
6. **State Management** - Event-driven state transitions with comprehensive error handling

### Key Design Patterns
- **Factory Pattern** - Clean separation of adapter creation from configuration
- **Proxy Architecture** - CodeLLDB subprocess management with transparent DAP communication
- **Graceful Degradation** - Warnings for optional dependencies, errors only for critical requirements
- **Platform Awareness** - Windows MSVC/GNU toolchain compatibility with configurable behavior
- **Caching Strategy** - Optimized executable resolution with TTL-based invalidation

## Integration Points

The package integrates with multiple external systems:
- **MCP Framework** - Standards-compliant debug adapter implementation
- **CodeLLDB Backend** - LLDB-based debugging through TCP communication
- **Rust Toolchain** - Deep cargo/rustc integration for build system operations
- **VS Code DAP** - Full Debug Adapter Protocol compliance
- **Platform Tools** - OS-specific tooling (Windows dlltool, Unix shared libraries)

## Build & Development

The package includes comprehensive build tooling with environment-based configuration, extensive caching mechanisms, and CI/CD optimization. The vendoring system supports offline development modes while ensuring consistent debugging capabilities across all supported platforms.

This package serves as a complete, production-ready solution for Rust debugging within the MCP ecosystem, handling the complexity of Rust toolchain integration while providing clean, standards-compliant interfaces for debugging workflows.
# packages\adapter-rust\src/
@generated: 2026-02-12T21:06:09Z

## Rust Debug Adapter Module

**Overall Purpose**: Complete Rust debugging solution within the MCP debugger ecosystem, providing seamless integration between Rust source code and native debuggers through CodeLLDB. This module transforms Rust development workflows into debugging sessions by managing toolchain dependencies, project resolution, binary compilation, and debug adapter lifecycle.

## Key Components & Architecture

### Core Adapter Infrastructure
- **RustDebugAdapter**: Main debug adapter class implementing the Debug Adapter Protocol (DAP) with Rust-specific extensions and state management
- **RustAdapterFactory**: Factory pattern implementation for adapter instantiation and comprehensive environment validation
- **index.ts**: Unified public API surface exposing all debugging components and utilities

### Utility Ecosystem (`utils/`)
- **Toolchain Management**: Rust/Cargo installation detection, version checking, and build orchestration
- **Project Resolution**: Cargo workspace discovery, metadata extraction, and target analysis  
- **Binary Analysis**: Post-compilation binary format detection (MSVC/GNU, PDB/DWARF) for debug compatibility
- **CodeLLDB Integration**: Cross-platform debugger executable resolution with fallback strategies

## Public API Surface

### Main Entry Points
```typescript
// Core debugging interface
RustDebugAdapter: IDebugAdapter
RustAdapterFactory: IAdapterFactory

// Project & toolchain utilities  
resolveCargoProject(path): Promise<CargoProject>
checkCargoInstallation(): Promise<boolean>
getCargoTargets(projectPath): Promise<CargoTarget[]>

// Debug infrastructure
resolveCodeLLDBExecutable(): Promise<string>
detectBinaryFormat(binary): Promise<BinaryInfo>
```

### Factory Pattern Integration
The `RustAdapterFactory` serves as the primary integration point, providing:
- Environment validation (CodeLLDB availability, toolchain compatibility)
- Adapter metadata (supported file extensions, language configuration)
- Dependency injection for adapter instantiation

## Internal Data Flow

### Debug Session Lifecycle
1. **Environment Validation**: Factory validates CodeLLDB, Cargo, and toolchain compatibility
2. **Project Discovery**: Utilities locate Cargo.toml, extract metadata, identify targets
3. **Build Pipeline**: Intelligent rebuild detection, cargo compilation, binary analysis
4. **Adapter Configuration**: Transform Rust launch configs to CodeLLDB parameters
5. **Debug Session**: ProxyManager spawns CodeLLDB, manages DAP communication

### Cross-Platform Considerations
- **Windows Toolchain Handling**: MSVC vs GNU detection with debug format validation
- **CodeLLDB Resolution**: Multi-architecture executable discovery (x64/arm64, all platforms)
- **Path Normalization**: Cross-platform path handling for embedded and container environments

## Important Patterns & Conventions

### Graceful Degradation Strategy
- Comprehensive error handling with fallback modes (relaxed environment detection)
- Optional dependency warnings vs. critical errors (Cargo recommended, CodeLLDB required)
- Platform-specific guidance for missing dependencies

### Performance Optimizations
- **Executable Path Caching**: 60-second TTL for resolved binary paths
- **Selective Binary Analysis**: Limited memory scanning for format detection
- **Incremental Builds**: mtime-based rebuild detection avoiding unnecessary compilation

### State Management
- **Adapter State Machine**: UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING
- **Toolchain Validation Caching**: Persistent validation results for session reuse
- **Thread Tracking**: DAP event-driven debugging state synchronization

## Integration Points

**MCP Debugger Framework**: Implements standard `IDebugAdapter` and `IAdapterFactory` interfaces for seamless integration with the broader debugging ecosystem.

**CodeLLDB Debugger**: Provides Rust-specific configuration and command-line argument construction for LLDB-based native debugging.

**Cargo Build System**: Deep integration with Rust's official build system for project discovery, dependency management, and target compilation.

This module represents a complete debugging solution that bridges the gap between high-level Rust development and low-level native debugging capabilities.
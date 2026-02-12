# packages\adapter-rust/
@generated: 2026-02-12T21:06:28Z

## Rust Debug Adapter Package

**Overall Purpose**: Complete Rust debugging solution for the MCP (Model Context Protocol) debugger ecosystem. This package provides seamless integration between Rust development workflows and native debugging capabilities through CodeLLDB, enabling developers to debug Rust applications with full DAP (Debug Adapter Protocol) support.

## Key Components and Integration

### Core Architecture
- **`src/`**: Complete debugging implementation with `RustDebugAdapter` (DAP interface), `RustAdapterFactory` (environment validation), and comprehensive utilities for Rust toolchain integration
- **`scripts/`**: Automated infrastructure provisioning through `vendor-codelldb.js`, which downloads and organizes platform-specific CodeLLDB debugger binaries across Windows, macOS, and Linux
- **`tests/`**: Comprehensive test coverage validating all components through unit tests with mocking strategies for cargo commands, binary analysis, and cross-platform compatibility

### Component Relationships
The package operates as a three-layer architecture:
1. **Infrastructure Layer** (`scripts/`): Provisions native debugging binaries and handles platform-specific setup
2. **Adapter Layer** (`src/`): Implements debugging logic, Rust toolchain integration, and DAP protocol handling  
3. **Validation Layer** (`tests/`): Ensures reliability through extensive testing of all integration points

## Public API Surface

### Main Entry Points
```typescript
// Primary debugging interfaces
RustDebugAdapter: IDebugAdapter          // DAP implementation for Rust
RustAdapterFactory: IAdapterFactory      // Environment validation and instantiation

// Rust ecosystem utilities
resolveCargoProject(path): Promise<CargoProject>
checkCargoInstallation(): Promise<boolean>  
getCargoTargets(projectPath): Promise<CargoTarget[]>

// Debug infrastructure
resolveCodeLLDBExecutable(): Promise<string>
detectBinaryFormat(binary): Promise<BinaryInfo>
```

### CLI Tooling
```bash
# Infrastructure setup
node scripts/vendor-codelldb.js [platforms...]

# Environment configuration
CODELLDB_VERSION, SKIP_ADAPTER_VENDOR, CODELLDB_FORCE_REBUILD
```

## Internal Organization and Data Flow

### Debug Session Workflow
1. **Environment Setup**: Scripts provision CodeLLDB binaries for target platforms
2. **Toolchain Validation**: Factory validates Rust/Cargo installation and CodeLLDB availability  
3. **Project Discovery**: Utilities locate Cargo projects, extract metadata, identify debug targets
4. **Build Orchestration**: Intelligent compilation with binary format analysis (MSVC/GNU, PDB/DWARF)
5. **Debug Session**: Adapter spawns CodeLLDB with Rust-specific configuration and manages DAP communication

### Cross-Platform Strategy
- **Binary Provisioning**: Automated download of platform-specific CodeLLDB debuggers (x64/ARM64)
- **Toolchain Detection**: Windows MSVC/GNU distinction with debug format compatibility validation
- **Path Resolution**: Cross-platform executable discovery with caching and fallback mechanisms

## Important Patterns and Conventions

### Graceful Degradation
- **Environment Validation**: Comprehensive checks with meaningful error messages and recovery suggestions
- **Optional Dependencies**: Cargo recommended but not required, CodeLLDB mandatory with clear setup guidance
- **Failure Modes**: Graceful handling of missing tools, malformed projects, and compilation failures

### Performance Optimizations
- **Intelligent Caching**: 60-second TTL for resolved paths, SHA256-validated binary artifacts
- **Selective Analysis**: Limited memory scanning for binary format detection
- **Incremental Builds**: mtime-based rebuild detection avoiding unnecessary compilation

### Development Experience
- **CI/CD Integration**: Environment-aware logging and automated dependency provisioning
- **Monorepo Support**: Workspace-relative imports with shared utilities (`@debugmcp/shared`)
- **Testing Infrastructure**: Comprehensive mocking for isolated unit tests without system dependencies

## Integration Points

**MCP Debugger Framework**: Implements standard debugging interfaces (`IDebugAdapter`, `IAdapterFactory`) for seamless integration with the broader MCP ecosystem.

**CodeLLDB Debugger**: Provides Rust-specific configuration, command-line argument construction, and process management for LLDB-based native debugging.

**Rust Toolchain**: Deep integration with Cargo build system for project discovery, dependency management, target compilation, and binary analysis.

This package represents a complete, production-ready debugging solution that transforms Rust development into a fully-featured debugging experience within the MCP framework.
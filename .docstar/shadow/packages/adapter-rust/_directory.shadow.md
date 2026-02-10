# packages/adapter-rust/
@generated: 2026-02-10T01:20:30Z

## Overall Purpose and Responsibility

The `packages/adapter-rust` directory implements a complete Rust debugging solution for the MCP (Model Context Protocol) debugger framework. This package provides seamless integration between Rust development environments and CodeLLDB debugging capabilities, handling the entire debugging lifecycle from project discovery and build orchestration to debug session management and binary analysis.

## Key Components and Integration

The adapter follows a layered architecture with clear separation of concerns:

### **Core Adapter Layer** (`src/`)
- `RustDebugAdapter` - Primary debug adapter implementing state machine management (UNINITIALIZED → READY → CONNECTED → DEBUGGING)
- `RustAdapterFactory` - Factory pattern implementation for adapter instantiation and environment validation
- Proxy-based architecture coordinating with CodeLLDB through DAP (Debug Adapter Protocol) communication

### **Infrastructure Utilities** (`src/utils/`)
- **Toolchain Management** - Rust/Cargo environment validation and binary path resolution
- **Project Operations** - Cargo project discovery, building, testing, and metadata extraction  
- **Binary Analysis** - Compiled binary format detection (MSVC vs GNU, PDB vs DWARF)
- **Debug Integration** - CodeLLDB executable resolution across deployment scenarios

### **Dependency Management** (`scripts/`)
- **Binary Vendoring** - Automated downloading, caching, and organization of cross-platform CodeLLDB debugger binaries
- **Environment Configuration** - Extensive configuration options for CI/CD and local development environments
- **Cross-Platform Support** - Handles 5 supported platform targets with intelligent caching and validation

### **Test Infrastructure** (`tests/`)
- **Comprehensive Test Coverage** - Full validation of adapter functionality, toolchain integration, and DAP communication
- **Mock Strategy** - Sophisticated mocking of external dependencies with configurable behaviors
- **Platform Testing** - Cross-platform validation with runtime platform overrides

### **Build Configuration** (`vitest.config.ts`)
- **Test Environment Setup** - Vitest configuration with workspace dependency resolution and TypeScript handling

## Public API Surface

### **Main Entry Points** (exported from `src/index.ts`)
- `RustDebugAdapter` - Core debug adapter class with full debugging lifecycle management
- `RustAdapterFactory` - Factory for adapter creation and environment validation
- `resolveCodeLLDBPath`, `checkCargoInstallation` - Environment setup utilities
- `resolveCargoProject`, `getCargoTargets` - Project management functions
- `detectBinaryFormat`, `BinaryInfo` - Binary analysis capabilities

### **Configuration Interface**
- `RustLaunchConfig` - Extends base launch configuration with Rust-specific options
- Supports debugging of binaries, examples, tests, and benchmarks
- Configurable MSVC/GNU toolchain compatibility handling

### **Automation Interface**
- `vendor-codelldb.js` script with CLI and environment-based configuration
- Extensible platform support and caching strategies

## Internal Organization and Data Flow

### **Complete Debugging Pipeline**
1. **Environment Validation** - Factory validates CodeLLDB availability, Rust toolchain, and platform compatibility
2. **Project Discovery** - Cargo utilities locate project roots and parse configurations
3. **Build Orchestration** - Intelligent rebuild detection and cargo command execution
4. **Binary Analysis** - Post-build toolchain classification determines debug configuration
5. **Debug Session** - Adapter spawns CodeLLDB, manages DAP communication, handles Rust-specific features

### **Cross-Component Integration**
- **Scripts → Adapter**: Vendoring ensures CodeLLDB availability before adapter initialization
- **Utils → Adapter**: Infrastructure utilities provide validated toolchain information and project metadata
- **Tests → All Components**: Comprehensive validation ensures reliability across diverse environments
- **Config → All Components**: Centralized build configuration enables consistent development workflows

## Important Patterns and Conventions

### **Factory Pattern**
Clean separation of adapter creation from configuration and validation logic, enabling flexible instantiation strategies.

### **State Machine Management** 
Explicit adapter lifecycle with proper error handling, cleanup, and transition validation.

### **Graceful Degradation**
Robust fallback chains handle missing dependencies, varied deployment scenarios, and platform differences.

### **Intelligent Caching**
Multi-level caching from binary vendoring to executable path resolution, optimized for both CI and local development.

### **Platform Abstraction**
Unified cross-platform compatibility layer handling Windows/macOS/Linux differences in toolchains, binaries, and debugging configurations.

This package represents a production-ready solution for Rust debugging within the MCP framework, providing comprehensive toolchain integration, robust error handling, and seamless developer experience across diverse platforms and deployment scenarios.
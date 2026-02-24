# packages\adapter-rust/
@children-hash: 398818e6d32dd633
@generated: 2026-02-24T01:55:01Z

## Rust Debug Adapter Package for MCP Debugger

This package provides a complete Rust debugging solution that integrates with the MCP (Model Context Protocol) debugger framework. It bridges Rust development workflows with standardized debugging protocols through CodeLLDB as the underlying debug engine, handling the full complexity of Rust toolchain management and cross-platform debugging requirements.

## Overall Purpose and Architecture

The `adapter-rust` package serves as a language-specific debug adapter that abstracts away Rust toolchain complexity while providing robust cross-platform debugging capabilities. It follows a layered architecture with clean separation of concerns:

1. **Factory Layer**: Environment validation and adapter creation
2. **Adapter Layer**: Debug session orchestration and state management  
3. **Utility Layer**: Rust ecosystem integration (toolchain, Cargo, binary analysis)
4. **Build Automation**: CodeLLDB vendoring and dependency management

## Key Components and Integration

### Core Debug Adapter (`src/`)
- **`rust-debug-adapter.ts`**: Main adapter implementation extending EventEmitter with IDebugAdapter interface, managing complete debugging lifecycle from initialization to session termination
- **`rust-adapter-factory.ts`**: Factory pattern implementation with comprehensive environment validation including CodeLLDB availability, Cargo installation, and Windows MSVC vs GNU toolchain detection
- **`index.ts`**: Public API entry point exporting all interfaces and utilities

### Specialized Utilities (`src/utils/`)
- **Toolchain Integration** (`rust-utils.ts`): Rust/Cargo detection and version management
- **Project Management** (`cargo-utils.ts`): Workspace resolution, building, and target discovery
- **Binary Analysis** (`binary-detector.ts`): Executable format detection for toolchain compatibility
- **Debug Environment** (`codelldb-resolver.ts`): CodeLLDB path resolution and configuration

### Build Infrastructure (`scripts/`)
- **`vendor-codelldb.js`**: Comprehensive vendoring system that downloads, caches, and organizes CodeLLDB binaries across 5 platform targets (Windows, macOS x64/ARM64, Linux x64/ARM64) with intelligent caching and retry mechanisms

### Testing Suite (`tests/`)
Comprehensive test coverage including adapter lifecycle testing, toolchain validation, Cargo integration, and binary analysis with extensive mocking infrastructure for cross-platform validation.

## Public API Surface

### Main Entry Points
- `RustDebugAdapter`: Primary debug adapter with full DAP compliance and Rust-specific customizations
- `RustAdapterFactory`: Factory for adapter creation with environment validation
- `resolveCodeLLDBPath()`, `resolveCodeLLDBExecutable()`: Debug engine path resolution
- `checkCargoInstallation()`: Rust toolchain validation
- `resolveCargoProject()`, `getCargoTargets()`: Project discovery and metadata extraction
- `detectBinaryFormat()`: Binary analysis for toolchain compatibility

### Configuration Interfaces
- `RustLaunchConfig`: Rust-specific debugging configuration
- `BinaryInfo`: Structured binary metadata for toolchain compatibility

## Data Flow and Integration Patterns

### Debug Session Lifecycle
1. **Environment Validation**: Factory validates CodeLLDB, Cargo, and toolchain compatibility
2. **Project Discovery**: Resolves source files to compiled binaries through Cargo workspace analysis
3. **Build Orchestration**: Manages compilation with up-to-date checking and rebuild detection
4. **Debug Engine Setup**: Configures CodeLLDB with platform-specific parameters and TCP mode
5. **DAP Communication**: Handles Debug Adapter Protocol through ProxyManager with Rust-specific customizations

### Cross-Platform Support Strategy
- **Vendoring System**: Self-contained CodeLLDB distribution eliminating runtime dependencies
- **Platform Detection**: Intelligent platform targeting for current vs all supported architectures
- **Toolchain Compatibility**: Windows MSVC vs GNU handling with comprehensive validation
- **Path Resolution**: Cross-platform binary and library location management

## Build and Distribution

The package follows ES module patterns with TypeScript compilation, workspace dependency management through `@debugmcp/shared`, and automated CodeLLDB vendoring for offline deployment. The vendoring system supports CI optimization with cache management and can operate in cache-only mode for environments with restricted network access.

## Error Handling and Resilience

Implements defense-in-depth error handling with graceful degradation, comprehensive error translation for Rust/CodeLLDB issues, environment-specific troubleshooting guidance, and support for containerized environments through relaxed mode configurations.

This package provides a production-ready Rust debugging solution that seamlessly integrates with the MCP debugger ecosystem while handling the complete spectrum of Rust development environment complexity.
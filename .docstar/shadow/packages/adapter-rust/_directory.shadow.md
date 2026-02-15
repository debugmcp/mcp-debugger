# packages\adapter-rust/
@children-hash: 3f6601b477598cc1
@generated: 2026-02-15T09:02:11Z

## Rust Debug Adapter Package

This directory implements a complete Rust debugging solution for the MCP (Model Context Protocol) debugger framework, providing comprehensive integration with the Rust ecosystem through CodeLLDB as the underlying debug engine.

## Overall Purpose and Responsibility

The `adapter-rust` package serves as a specialized debug adapter that bridges Rust development workflows with standardized debugging protocols. It abstracts away Rust toolchain complexity while providing robust cross-platform debugging capabilities, handling the complete debugging lifecycle from environment validation and project discovery to executable analysis and debug session management.

## Key Components and Integration

### Core Architecture (src/)
The source code follows a layered architecture with clear separation of concerns:

**Factory Layer** (`rust-adapter-factory.ts`):
- Implements `IAdapterFactory` pattern for clean dependency injection
- Performs comprehensive environment validation (CodeLLDB, Cargo, toolchain compatibility)
- Handles platform-specific toolchain detection (Windows MSVC vs GNU)

**Adapter Layer** (`rust-debug-adapter.ts`):
- Core adapter implementation extending EventEmitter with IDebugAdapter compliance
- Manages state machine: UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING
- Orchestrates executable resolution, toolchain validation, and CodeLLDB integration
- Handles DAP (Debug Adapter Protocol) operations with Rust-specific customizations

**Utility Layer** (`utils/`):
- **Toolchain Integration**: Rust/Cargo detection and version management
- **Project Management**: Cargo workspace resolution, building, target discovery
- **Binary Analysis**: Executable format detection and debug information scanning
- **Debug Environment**: CodeLLDB path resolution and compatibility checking

### Build Automation (scripts/)
The `scripts/` directory provides essential build-time tooling:

**Vendoring System** (`vendor-codelldb.js`):
- Downloads and caches CodeLLDB VSIX packages from GitHub releases
- Extracts platform-specific binaries for 5 supported platforms (Windows, macOS, Linux)
- Implements robust caching, retry mechanisms, and integrity validation
- Eliminates runtime dependency requirements through self-contained vendor tree

### Testing Infrastructure (tests/)
Comprehensive test coverage validates all integration points:
- **Adapter Testing**: Core functionality, capabilities, launch configuration
- **Toolchain Testing**: Environment validation, executable resolution, platform behavior
- **Utility Testing**: Cargo integration, binary analysis, Rust toolchain detection
- **Mock Infrastructure**: Process simulation, filesystem mocking, platform override utilities

### Configuration (vitest.config.ts)
Test environment configuration supporting:
- TypeScript-to-JavaScript compilation handling
- Monorepo workspace dependency resolution
- Cross-platform path resolution

## Public API Surface

### Primary Entry Points (`src/index.ts`)

**Core Classes**:
- `RustDebugAdapter`: Main debug adapter with full DAP compliance and Rust-specific features
- `RustAdapterFactory`: Factory for adapter creation with environment validation

**Utility Functions**:
- `resolveCodeLLDBPath()`, `resolveCodeLLDBExecutable()`: Debug engine resolution
- `checkCargoInstallation()`: Rust toolchain validation
- `resolveCargoProject()`, `getCargoTargets()`: Project discovery and metadata
- `detectBinaryFormat()`: Binary analysis for toolchain compatibility

**Type Definitions**:
- `BinaryInfo`: Structured binary metadata interface
- `RustLaunchConfig`: Rust-specific debugging configuration

### Build Integration

**Script Interface**:
```bash
node scripts/vendor-codelldb.js [platforms...]
```

**Environment Variables**:
- `CODELLDB_VERSION`: Version targeting
- `SKIP_ADAPTER_VENDOR`: Bypass mechanism
- `CODELLDB_FORCE_REBUILD`: Force fresh downloads
- Platform and cache configuration options

## Data Flow and Integration Patterns

### Environment Validation Workflow
1. Factory validates CodeLLDB availability (mandatory)
2. Checks Cargo installation with degradation warnings
3. Detects toolchain compatibility (especially Windows MSVC/GNU)
4. Returns structured validation results

### Debug Session Lifecycle
1. Adapter resolves source files to compiled binaries through Cargo integration
2. Performs binary format analysis for toolchain compatibility
3. Builds CodeLLDB command with TCP mode and Rust-specific configuration
4. Manages DAP communication through ProxyManager delegation
5. Handles Rust-specific debugging features (panic breakpoints, source mapping)

### Cross-Platform Support Strategy
- Platform-aware executable resolution and binary analysis
- Windows-specific toolchain handling (MSVC vs GNU detection)
- Architecture-specific debugging tool configuration
- Containerized environment support through relaxed validation modes

## Key Design Patterns

**Factory Pattern**: Clean separation between adapter creation and configuration enabling testability and dependency injection

**Proxy Architecture**: Delegates low-level DAP communication while maintaining Rust-specific customizations

**Layered Validation**: Multi-tier validation from factory environment checking to runtime toolchain compatibility

**Self-Contained Distribution**: Vendoring system ensures consistent debugging capabilities across platforms without external tool requirements

This package provides a production-ready Rust debugging solution that integrates seamlessly with the MCP debugger ecosystem while handling the full complexity of Rust toolchain management, cross-platform binary analysis, and standardized debug protocol implementation.
# packages/adapter-rust/
@generated: 2026-02-10T21:27:13Z

## Overall Purpose and Responsibility

The `packages/adapter-rust` directory implements a complete Rust debugging adapter for the MCP (Model Context Protocol) Debugger framework. This package provides seamless integration between Rust development tooling and debug clients by bridging the Rust ecosystem (Cargo, rustc) with the CodeLLDB debugger through the Debug Adapter Protocol (DAP). It handles the full debugging lifecycle from environment validation and project discovery to binary compilation and active debug session management.

## Key Components and Integration

### Core Architecture

The package follows a layered architecture with clear separation of concerns:

**Adapter Layer** (`src/`)
- `RustDebugAdapter`: Main debug adapter implementing EventEmitter and IDebugAdapter, managing state transitions and DAP communication
- `RustAdapterFactory`: Factory pattern with comprehensive environment validation and dependency injection

**Utility Foundation** (`src/utils/`)
- `cargo-utils.ts`: Cargo project management (discovery, metadata, build orchestration)  
- `rust-utils.ts`: Rust toolchain validation (Cargo/rustc detection, version management)
- `binary-detector.ts`: Executable format analysis (MSVC vs GNU detection)
- `codelldb-resolver.ts`: CodeLLDB debugger integration and resolution

**Build Infrastructure** (`scripts/`)
- `vendor-codelldb.js`: Cross-platform CodeLLDB vendoring with robust download/caching system
- Manages 5 target platforms with SHA256 validation and offline support

**Test Suite** (`tests/`)
- Comprehensive validation covering toolchain integration, binary detection, cargo operations
- Cross-platform testing with sophisticated mocking infrastructure
- End-to-end workflow validation from source to debug session

### Component Data Flow

```
Environment Validation → Project Discovery → Build Orchestration → Binary Analysis → Debug Session
     ↓                        ↓                    ↓                   ↓              ↓
RustAdapterFactory    →  cargo-utils       →  Cargo Build     →  binary-detector → RustDebugAdapter
     ↓                        ↓                    ↓                   ↓              ↓
rust-utils.ts        →  Workspace Mgmt     →  Change Detection →  Toolchain Compat → CodeLLDB Integration
codelldb-resolver    →  Target Discovery   →  Feature Selection → Debug Format    → DAP Communication
```

## Public API Surface

### Main Entry Points

**Primary Interfaces** (exported via `src/index.ts`):
- `RustDebugAdapter`: Core debug adapter class for direct instantiation
- `RustAdapterFactory`: Recommended factory entry point with built-in validation
- `RustLaunchConfig`: Rust-specific debug configuration interface

**Utility Functions**:
- `resolveCodeLLDBPath` / `resolveCodeLLDBExecutable`: CodeLLDB debugger resolution
- `checkCargoInstallation`: Rust toolchain validation
- `resolveCargoProject` / `getCargoTargets`: Cargo workspace management  
- `detectBinaryFormat`: Binary analysis for toolchain compatibility

**Key Data Structures**:
- `BinaryInfo`: Binary metadata for executable analysis
- `ToolchainValidationResult`: MSVC/GNU compatibility validation results

### Configuration and Environment

**Build-time Configuration**:
- Environment variables for CodeLLDB versioning and platform selection
- Vendoring script supports offline mode and custom cache directories
- CI/local environment detection with adaptive behavior

**Runtime Configuration**:  
- Flexible debug configurations (bin/example/test targets, features, release mode)
- LLDB customization and source mapping for standard library debugging
- Relaxed mode for containerized environments

## Internal Organization and Patterns

### Cross-Platform Architecture
- Extensive platform-aware logic for Windows (MSVC vs GNU), macOS, and Linux
- Special Windows handling for PDB readers and dlltool path management
- Platform-specific binary resolution and executable permission handling

### State Management and Lifecycle
- Robust state machine implementation (UNINITIALIZED → READY → CONNECTED → DEBUGGING)
- Connection pooling and executable path caching (60-second TTL)
- Comprehensive cleanup and error recovery mechanisms

### Build Integration Patterns
- Atomic vendoring operations with rollback capabilities
- Intelligent change detection for build optimization  
- Comprehensive logging with configurable severity levels
- Progress indication and timeout handling for long-running operations

### Error Handling Strategy
- Comprehensive error translation with actionable guidance for common issues
- Graceful degradation and fallback mechanisms throughout utility layers
- User-friendly error messages for debugging setup problems

## Role in Larger MCP System

This package serves as the specialized Rust debugging backend within the MCP Debugger ecosystem. It transforms generic debug requests into Rust-specific operations, handling the complexity of Rust toolchain integration while providing a standardized debug adapter interface to clients. The vendored CodeLLDB infrastructure ensures consistent debugging capabilities across all deployment environments, making Rust debugging as seamless as other supported languages within the MCP framework.

The adapter handles production-scale concerns including enterprise deployment, containerized environments, and cross-platform compatibility while maintaining the flexibility needed for diverse Rust development workflows.
# packages/adapter-rust/
@generated: 2026-02-09T18:20:52Z

## Overall Purpose & Responsibility

The `packages/adapter-rust` directory implements a complete Rust debugging adapter for the MCP (Model Context Protocol) Debugger ecosystem. This package serves as a comprehensive bridge between generic debug requests and the CodeLLDB debugger, providing Rust-specific toolchain integration, project analysis, and cross-platform debugging session management with self-contained binary distributions.

## Key Components & Integration Architecture

### Core Debugging Infrastructure (`src/`)
- **`RustDebugAdapter`**: Main debugging session controller managing state transitions (UNINITIALIZED → READY → DEBUGGING) and translating generic debug configurations to CodeLLDB-specific parameters
- **`RustAdapterFactory`**: Dependency-injected factory providing adapter instantiation with comprehensive environment validation and metadata provision
- **Utility Layer**: Comprehensive toolchain integration including Rust/Cargo detection (`rust-utils.ts`), project operations (`cargo-utils.ts`), CodeLLDB resolution (`codelldb-resolver.ts`), and Windows binary format analysis (`binary-detector.ts`)

### Binary Distribution System (`vendor/` + `scripts/`)
- **CodeLLDB Vendor Management**: Complete self-contained debugger distributions across multiple platforms (darwin-arm64/x64, linux-arm64/x64, win32-x64) with integrated LLDB engines and Python environments
- **Automated Vendoring Pipeline**: Sophisticated binary management system (`vendor-codelldb.js`) that downloads, caches, and organizes platform-specific debugger binaries from GitHub releases
- **Zero-Dependency Deployment**: Each vendor distribution contains complete debugging environments with LLDB runtime, DAP implementation, and Rust-optimized language support

### Quality Assurance (`tests/`)
- **Comprehensive Test Coverage**: Complete validation of adapter functionality, toolchain management, binary format detection, and Cargo project integration
- **Cross-Platform Testing**: Mock-based testing infrastructure supporting Windows (MSVC/GNU), Linux, and macOS scenarios with isolated temporary workspaces
- **Integration Validation**: End-to-end testing of debugging workflows from project discovery through debug session management

### Development Infrastructure
- **Build Configuration**: Vitest-based testing setup (`vitest.config.ts`) with TypeScript support and workspace module resolution
- **Development Tooling**: Configured for local development with shared package aliases and extension handling for TypeScript compilation

## Public API Surface & Entry Points

### Primary Integration Points
- **`RustDebugAdapter`**: Main debugging session interface with DAP compliance, connection lifecycle management, and state tracking
- **`RustAdapterFactory`**: Adapter creation with environment validation (`checkCargoInstallation()`, `resolveCodeLLDBPath()`, host triple detection)
- **Project Analysis**: `resolveCargoProject()`, `getCargoTargets()`, `detectBinaryFormat()` for Rust project introspection
- **Configuration Interface**: `RustLaunchConfig` with Rust-specific debugging options and toolchain compatibility settings

### Cross-Platform Capabilities
- **Toolchain Integration**: Automatic Rust/Cargo detection with version management and build system integration
- **Binary Analysis**: Windows toolchain compatibility assessment (MSVC/GNU detection) with PDB/DWARF debug information extraction
- **Platform Adaptation**: Architecture-aware CodeLLDB resolution with platform-specific path handling and tool discovery

## Internal Organization & Data Flow

### Initialization & Validation Flow
1. **Environment Assessment**: Factory validates CodeLLDB availability, Cargo installation, and platform compatibility
2. **Dependency Resolution**: Automated discovery of debugging tools with fallback strategies and cache optimization
3. **Adapter Instantiation**: Dependency injection with pre-validated environment and configuration

### Debug Session Lifecycle
1. **Configuration Processing**: Transform generic launch configurations to CodeLLDB format with Rust-specific enhancements
2. **Toolchain Preparation**: Project analysis, binary resolution, and environment variable setup
3. **Session Management**: TCP-based proxy communication with CodeLLDB adapter, DAP translation, and state synchronization
4. **Runtime Integration**: Breakpoint management, variable inspection, and thread handling through unified debugging interface

### Binary Distribution Management
1. **Platform Detection**: Automatic target platform identification with cross-compilation support
2. **Caching Strategy**: SHA256-validated local cache with 60-second executable path optimization
3. **Vendor Organization**: Structured binary deployment with metadata tracking and integrity verification

## Important Patterns & Design Philosophy

### Reliability & Resilience
- **Graceful Degradation**: Utilities return null/empty rather than exceptions, with user-friendly error translation
- **Platform Abstraction**: Consistent API surface across Windows, macOS, and Linux with architecture-specific optimizations
- **Fail-Safe Architecture**: Component failures isolated to prevent system-wide debugging disruption

### Performance Optimizations
- **Intelligent Caching**: Multi-level caching for tool discovery, project analysis, and binary distribution management
- **Lazy Evaluation**: On-demand resource loading with bounded analysis limits (1MB binary scanning)
- **Resource Management**: Efficient subprocess handling and TCP connection pooling

### Development Experience
- **Zero-Configuration Setup**: Automatic toolchain discovery with comprehensive installation guidance
- **Self-Contained Distribution**: Complete debugging environments eliminate external dependency management
- **Cross-Platform Consistency**: Identical debugging capabilities across all supported architectures

## System Role in MCP Ecosystem

This adapter package serves as the essential Rust debugging bridge within the MCP Debugger ecosystem, transforming complex Rust toolchain interactions into standardized debugging operations. It abstracts platform-specific differences, manages sophisticated binary distribution requirements, and provides enterprise-grade debugging capabilities while leveraging CodeLLDB's LLDB-based debugging power. The package supports both traditional development environments and containerized scenarios through configurable validation modes and comprehensive toolchain integration.
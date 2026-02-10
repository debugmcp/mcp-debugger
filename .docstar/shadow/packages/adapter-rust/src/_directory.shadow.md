# packages/adapter-rust/src/
@generated: 2026-02-09T18:16:41Z

## Overall Purpose
The `packages/adapter-rust/src` directory implements a complete Rust debugging adapter for the MCP (Model Context Protocol) Debugger ecosystem. This module provides a bridge between generic debug requests and the CodeLLDB debugger, handling Rust-specific toolchain validation, project analysis, and debugging session management with comprehensive cross-platform support.

## Key Components and Architecture

**Core Adapter Layer**:
- `RustDebugAdapter`: Main adapter implementation that manages debugging sessions, validates environments, and translates generic debug configurations to CodeLLDB-specific parameters
- `RustAdapterFactory`: Factory for creating adapter instances with dependency injection and comprehensive environment validation

**Utility Infrastructure**:
- `utils/rust-utils.ts`: Foundation toolchain integration (Rust/Cargo installation detection, version management)
- `utils/cargo-utils.ts`: Cargo project operations (building, testing, dependency management, project analysis)
- `utils/codelldb-resolver.ts`: Debug tool resolution and CodeLLDB executable discovery
- `utils/binary-detector.ts`: Post-compilation binary analysis for Windows toolchain compatibility (MSVC/GNU detection)

**Integration Layer**:
- `index.ts`: Barrel export providing unified public API surface

## Public API Surface

### Main Entry Points
- **`RustDebugAdapter`**: Primary debugging session controller with state management (UNINITIALIZED → READY → DEBUGGING)
- **`RustAdapterFactory`**: Adapter instantiation with environment validation and metadata provision
- **Environment Utilities**: `resolveCodeLLDBPath()`, `checkCargoInstallation()`, `resolveCargoProject()`, `getCargoTargets()`
- **Binary Analysis**: `detectBinaryFormat()`, `BinaryInfo` type for toolchain compatibility assessment

### Configuration Interface
- **`RustLaunchConfig`**: Extended debug configuration with Rust-specific options
- **Toolchain Management**: MSVC/GNU compatibility handling with configurable validation behavior
- **Cross-platform Support**: Windows, macOS, Linux with architecture-aware resolution

## Internal Organization and Data Flow

### Initialization Flow
1. **Factory Validation**: Environment checking (CodeLLDB availability, Cargo installation, host triple detection)
2. **Adapter Creation**: Dependency injection with pre-validated environment
3. **Session Setup**: TCP proxy configuration, toolchain validation, binary resolution

### Debug Session Flow
1. **Configuration Processing**: Transform generic launch configs to CodeLLDB format
2. **Environment Preparation**: Path resolution, environment variables, Python integration setup
3. **Connection Management**: TCP-based proxy communication with CodeLLDB adapter
4. **State Tracking**: Thread management, breakpoint handling, variable inspection

### Toolchain Integration
1. **Discovery Phase**: Rust/Cargo detection → project analysis → target identification
2. **Validation Phase**: Binary format analysis → toolchain compatibility → build requirements
3. **Execution Phase**: CodeLLDB resolution → debug session establishment → DAP translation

## Important Patterns and Conventions

### Error Handling Strategy
- **Graceful Degradation**: Utilities return null/empty rather than throwing exceptions
- **User-Friendly Messages**: Technical errors translated to actionable guidance
- **Installation Instructions**: Platform-specific setup guidance for missing components

### Cross-Platform Adaptations
- **Windows-Specific**: MSVC/GNU toolchain detection, PDB reader configuration, path sanitization
- **Platform Mapping**: Architecture-aware CodeLLDB resolution (darwin-arm64, linux-x64)
- **Tool Discovery**: Multi-path fallback strategies with environment variable overrides

### Performance Optimizations
- **Caching System**: 60-second executable path cache, validation result storage
- **Lazy Evaluation**: On-demand file system scanning and toolchain detection
- **Resource Management**: 1MB binary analysis limits, bounded project scanning

### Dependency Management
- **External Tools**: CodeLLDB debugger, Rust toolchain (rustc/cargo), Windows dlltool
- **Node.js Integration**: Subprocess management, filesystem operations, TCP networking
- **MCP Ecosystem**: Implements standard debug adapter interfaces for framework integration

## System Role
This adapter serves as the essential bridge enabling Rust debugging within the MCP Debugger ecosystem. It abstracts Rust toolchain complexity, manages platform-specific differences, and provides a standardized debugging interface while leveraging CodeLLDB's powerful LLDB-based debugging capabilities. The module supports both traditional development environments and containerized/prebuilt scenarios through relaxed validation modes.
# packages/
@children-hash: 48a7154af451f727
@generated: 2026-02-24T01:56:22Z

## Overall Purpose and Responsibility

The `packages` directory contains the complete ecosystem for a multi-language debug adapter framework built on the Debug Adapter Protocol (DAP). This module collection provides a unified debugging solution supporting JavaScript/TypeScript, Python, Go, and Rust development through standardized interfaces while maintaining the flexibility for language-specific optimizations and toolchain integration.

## Architecture and Component Integration

### Core Framework Foundation
The **`shared`** package serves as the architectural foundation, providing type-safe contracts, interface definitions, and common utilities that enable consistent debugging behavior across all language adapters. It exports over 200 types and utilities, including the core `IDebugAdapter` interface, `AdapterPolicy` implementations, session management models, and factory patterns that ensure uniform adapter creation and lifecycle management.

### Language-Specific Adapters
Each adapter package implements the shared interfaces while handling language-specific complexities:

- **`adapter-javascript`**: Bridges Microsoft's vscode-js-debug with intelligent project detection, TypeScript support, and ESM/CommonJS compatibility
- **`adapter-python`**: Integrates debugpy with cross-platform Python discovery, virtual environment support, and Django/Flask debugging capabilities  
- **`adapter-go`**: Provides comprehensive Go debugging through Delve DAP integration with goroutine management and build toolchain validation
- **`adapter-rust`**: Enables Rust debugging via CodeLLDB with Cargo workspace integration and cross-platform binary analysis

### Development and Distribution Infrastructure
- **`adapter-mock`**: Complete DAP-compliant mock implementation for testing and development, enabling systematic error scenario testing and isolated validation
- **`mcp-debugger`**: Batteries-included CLI distribution that bundles all adapters into a standalone executable with strict MCP protocol compliance

## Key Components and Data Flow

### Initialization and Discovery Phase
1. **Environment Validation**: Each adapter factory validates language-specific toolchains (Node.js ≥14, Python 3.7+, Go 1.18+, Rust/Cargo, debugger availability)
2. **Project Detection**: Intelligent analysis of project structure, configuration files, and runtime requirements
3. **Adapter Registry**: Dynamic loading and registration of available debug adapters through the shared factory framework

### Debug Session Lifecycle
1. **Configuration Transform**: Generic launch configurations converted to language-specific debugger parameters
2. **Process Orchestration**: Spawning and managing underlying debug servers (js-debug, debugpy, Delve, CodeLLDB) with proper lifecycle control
3. **Protocol Bridging**: DAP message handling between debug clients and language-specific debug engines
4. **State Management**: Unified session tracking with adapter-specific customizations for breakpoints, variable inspection, and execution control

### Vendor and Dependency Management
Several packages include sophisticated vendoring systems that automatically acquire and bundle necessary debug engines:
- JavaScript adapter vendors Microsoft's js-debug with multi-strategy acquisition
- Rust adapter includes CodeLLDB vendoring across 5 platform targets
- Go adapter integrates with system-installed Delve while providing installation guidance

## Public API Surface

### Primary Entry Points
- **`@debugmcp/mcp-debugger`**: Main CLI tool providing unified debugging across all supported languages
- **`@debugmcp/shared`**: Core framework types and utilities for adapter development
- **Language-specific factories**: `JavascriptAdapterFactory`, `PythonAdapterFactory`, `GoAdapterFactory`, `RustAdapterFactory` for targeted debugging
- **`@debugmcp/adapter-mock`**: Testing and development utilities with full DAP simulation

### Integration Interfaces
- **`IDebugAdapter`**: Universal adapter interface ensuring consistent debugging behavior
- **`IAdapterFactory`**: Factory pattern for validated adapter creation with environment checking
- **Language-specific configurations**: Extended launch config types supporting framework-specific options (Django, Flask, Cargo features, etc.)
- **Cross-platform utilities**: Executable discovery, toolchain validation, and environment management

## Internal Organization Patterns

### Architectural Consistency
All packages follow consistent patterns with TypeScript ES module builds, comprehensive test coverage (90%+ requirement), workspace dependency management, and factory-based instantiation with dependency injection for testability.

### Cross-Platform Robustness
The framework handles platform differences transparently through intelligent executable discovery, path resolution abstractions, Windows Store alias filtering, and comprehensive fallback mechanisms for missing dependencies.

### Error Handling Strategy
Implements defense-in-depth with structured error reporting, user-friendly installation guidance, graceful degradation for optional components, and environment-specific troubleshooting information.

This packages directory represents a complete debugging ecosystem that abstracts away language-specific complexity while providing robust, standardized debugging capabilities through the Debug Adapter Protocol, enabling seamless integration with VS Code and other DAP-compatible development environments.
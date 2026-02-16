# packages/
@children-hash: 6510f07f59d09f19
@generated: 2026-02-16T08:25:45Z

## Overall Purpose and Responsibility

The `packages` directory contains the complete MCP (Model Context Protocol) Debugger ecosystem - a comprehensive, multi-language debugging framework that provides unified debugging capabilities across JavaScript, Python, Go, and Rust. This module implements a pluggable Debug Adapter Protocol (DAP) architecture that enables consistent debugging experiences while adapting to language-specific toolchains and runtime environments.

## Key Components and Integration

### Core Framework Architecture
- **`shared/`** - Foundational contracts and abstractions defining the IDebugAdapter interface, session management, configuration system, and policy framework that enables language-agnostic debugging
- **`mcp-debugger/`** - Primary CLI distribution tool that bundles all adapters into a batteries-included debugging solution with MCP protocol compliance and multi-transport support (stdio/SSE)

### Language-Specific Adapters
- **`adapter-javascript/`** - Production-ready JavaScript/TypeScript debugging through VS Code's js-debug server with intelligent project detection and cross-platform Node.js integration
- **`adapter-python/`** - Comprehensive Python debugging via debugpy with sophisticated environment detection, virtual environment support, and framework-specific configurations
- **`adapter-go/`** - Native Go debugging using Delve DAP with complete toolchain integration, goroutine management, and multi-mode debugging (apps, tests, core dumps)
- **`adapter-rust/`** - Advanced Rust debugging through CodeLLDB with Cargo workspace integration, binary analysis, and cross-platform toolchain compatibility
- **`adapter-mock/`** - Complete DAP testing framework providing protocol-compliant mock debugging for development and validation

### Integration Flow
1. **Shared Foundation**: All adapters implement common interfaces from `shared/` ensuring consistent behavior and protocol compliance
2. **Factory Pattern**: Each adapter provides factory implementations for environment validation and adapter instantiation
3. **CLI Distribution**: `mcp-debugger/` bundles all adapters into deployable packages with graceful degradation for missing dependencies
4. **Runtime Coordination**: Global adapter registry enables dynamic language detection and debugging session management

## Public API Surface

### Primary Entry Points
- **CLI Command**: `npx mcp-debugger` - Main debugging interface supporting multiple languages and transport modes
- **Adapter Factories**: Language-specific factories (`JavascriptAdapterFactory`, `PythonAdapterFactory`, `GoAdapterFactory`, `RustAdapterFactory`) for programmatic integration
- **Core Interfaces**: `IDebugAdapter`, `IAdapterRegistry`, `IAdapterFactory` from shared package for framework extension

### Language Support Matrix
- **JavaScript/TypeScript**: ESM/CommonJS detection, TypeScript runtime integration, VS Code js-debug compatibility
- **Python**: Virtual environment detection, debugpy integration, framework support (Django/Flask)
- **Go**: Delve DAP integration, goroutine management, multi-mode debugging (debug/test/exec/core)
- **Rust**: CodeLLDB integration, Cargo workspace handling, binary format analysis
- **Mock/Testing**: Full DAP simulation for development and testing workflows

### Configuration System
- **Generic Configuration**: Base launch/attach configurations with common DAP parameters
- **Language-Specific Extensions**: Specialized configurations (GoLaunchConfig, JsDebugConfig, etc.) with language-specific features
- **Environment Detection**: Automatic toolchain discovery with intelligent fallbacks and caching

## Internal Organization and Data Flow

### Development-to-Runtime Pipeline
1. **Development**: Language-specific adapters developed against shared interfaces with comprehensive testing
2. **Build Phase**: Sophisticated bundling system creates self-contained distributions with vendored dependencies
3. **Environment Validation**: Multi-tier validation from toolchain detection to runtime compatibility checking
4. **Debugging Session**: Coordinated adapter instantiation, DAP protocol handling, and state management

### Cross-Platform Architecture
- **Unified Toolchain Discovery**: Each adapter implements sophisticated, cached discovery of language-specific tools with platform-aware handling
- **Protocol Standardization**: All adapters provide consistent DAP compliance while adapting to language-specific debugging capabilities
- **Graceful Degradation**: Missing components generate warnings rather than failures, enabling partial functionality across diverse environments

## Important Patterns and Conventions

### Architectural Patterns
- **Plugin Architecture**: Modular adapter system with dynamic registration and discovery
- **Factory Pattern**: Consistent adapter creation with dependency injection and environment validation
- **Policy-Based Design**: Language-specific behaviors encapsulated behind common interfaces
- **Event-Driven Communication**: Comprehensive state management with EventEmitter-based coordination

### Quality Assurance Strategy
- **Comprehensive Testing**: Each package includes extensive unit/integration testing with cross-platform validation
- **Mock Infrastructure**: Sophisticated testing utilities enabling reliable validation without external dependencies
- **Coverage Standards**: High coverage thresholds (90%+) across all packages with detailed reporting

### Distribution Philosophy
- **Batteries-Included**: Single CLI tool bundles all adapters eliminating runtime dependency management
- **Self-Contained**: Vendored dependencies and cached toolchain discovery minimize external requirements
- **Protocol Safety**: MCP compliance through careful console output management and transport abstraction

This ecosystem provides a complete debugging solution that bridges the gap between diverse programming language toolchains and standardized debugging protocols, enabling consistent debugging experiences across polyglot development environments while maintaining the flexibility to adapt to language-specific requirements and platform constraints.
# packages/
@children-hash: 0d1796b47f03315e
@generated: 2026-02-23T15:27:30Z

## Overall Purpose and Responsibility

The `packages` directory contains the complete MCP Debugger ecosystem - a comprehensive multi-language debugging framework built on the Model Context Protocol. This monorepo structure provides a batteries-included debugging solution with native support for JavaScript/TypeScript, Python, Go, and Rust, along with a shared foundation layer and testing infrastructure. The system enables interactive debugging of MCP servers across different programming languages while maintaining protocol compliance and cross-platform compatibility.

## Key Components and Integration

### Core Framework Architecture
- **shared/**: Foundational shared library providing type-safe abstractions, interfaces, and common patterns
  - Defines `IDebugAdapter`, `IAdapterRegistry`, and `IAdapterFactory` core contracts
  - Implements policy-driven architecture with dependency injection for language-specific behaviors
  - Extends VS Code's Debug Adapter Protocol (DAP) with comprehensive session lifecycle management
  - Provides factory patterns, event-driven architecture, and cross-platform abstractions

### Language-Specific Debug Adapters
- **adapter-javascript/**: Complete JavaScript/TypeScript debugging via Microsoft's vscode-js-debug
  - Intelligent environment detection and configuration management
  - Automated vendoring system with multi-strategy dependency acquisition
  - Support for ESM/CommonJS, TypeScript runners, and modern JavaScript environments
  
- **adapter-python/**: Python debugging adapter with debugpy integration
  - Cross-platform Python executable discovery with Windows Store filtering
  - Virtual environment handling and multi-version Python support
  - Django/Flask debugging capabilities and subprocess debugging

- **adapter-go/**: Go debugging adapter leveraging native Delve DAP support
  - Support for applications, tests, executables, core dumps, and replay sessions
  - Sophisticated toolchain discovery with platform-specific optimizations
  - Goroutine filtering and comprehensive Go-specific debugging features

- **adapter-rust/**: Rust debugging solution through CodeLLDB integration
  - Cargo workspace integration with binary analysis and toolchain compatibility
  - Automated CodeLLDB vendoring across 5 supported platforms
  - Windows MSVC/GNU toolchain detection and cross-platform binary analysis

- **adapter-mock/**: Testing and development mock implementation
  - Complete DAP protocol simulation for validation and testing
  - Configurable error scenarios and deterministic behavior
  - Reference implementation for DAP compliance

### Distribution and CLI
- **mcp-debugger/**: Batteries-included CLI tool and distribution package
  - Protocol-compliant MCP server implementation
  - Global adapter registry with all language adapters bundled
  - Multi-format build pipeline (executable bundles, npm packages, platform-specific distributions)
  - Graceful degradation for missing platform components

## Component Integration and Data Flow

The packages follow a layered integration model:

1. **Foundation Layer**: `shared/` provides core interfaces, type definitions, and architectural patterns used by all adapters
2. **Adapter Layer**: Language-specific adapters implement the shared interfaces while handling toolchain discovery, environment validation, and protocol-specific behaviors
3. **Distribution Layer**: `mcp-debugger/` bundles all adapters into a cohesive CLI tool with protocol compliance and runtime coordination
4. **Build Coordination**: Each package includes sophisticated build automation for dependency vendoring, cross-platform compatibility, and artifact generation

## Public API Surface

### Primary Entry Points
- **Global Adapter Registry**: `__DEBUG_MCP_BUNDLED_ADAPTERS__` providing access to all language adapters
- **CLI Interface**: `npx @modelcontextprotocol/debugger` for interactive debugging workflows
- **Factory Pattern**: Language-specific adapter factories (`JavascriptAdapterFactory`, `PythonAdapterFactory`, etc.)
- **Shared Contracts**: `IDebugAdapter`, `IAdapterRegistry`, `IAdapterFactory` for extensibility

### Language Support APIs
- **JavaScript/TypeScript**: Automatic project detection, TypeScript runner support, ESM/CommonJS handling
- **Python**: Multi-version support, virtual environment detection, Django/Flask debugging
- **Go**: Delve integration, goroutine management, multiple debug modes (test, exec, core, replay)
- **Rust**: Cargo integration, binary analysis, CodeLLDB orchestration
- **Mock**: Complete DAP simulation for testing and development

### Configuration Interfaces
- **Generic Configuration**: Base launch/attach configurations extended by language-specific adapters
- **Language-Specific Configs**: `JsDebugConfig`, `PythonLaunchConfig`, `GoLaunchConfig`, `RustLaunchConfig`
- **Environment Detection**: Automatic toolchain discovery and version validation across all supported languages

## Key Architectural Patterns

### Multi-Language Debugging Strategy
- **Unified Interface**: All adapters implement consistent `IDebugAdapter` contract while supporting language-specific features
- **Protocol Delegation**: Native DAP implementations (Delve, debugpy, vscode-js-debug, CodeLLDB) rather than custom protocol translation
- **Environment Intelligence**: Sophisticated toolchain discovery with caching, fallback strategies, and cross-platform compatibility

### Distribution and Deployment
- **Self-Contained Packaging**: Vendored dependencies eliminate runtime requirements
- **Graceful Degradation**: Missing components generate warnings rather than failures
- **Protocol Safety**: Comprehensive stdout protection ensures MCP protocol compliance
- **Multi-Format Artifacts**: Single build process produces multiple consumption patterns

### Quality and Testing
- **Comprehensive Test Coverage**: All packages include extensive unit and integration testing
- **Mock Infrastructure**: Sophisticated mocking for reliable cross-platform testing
- **Performance Optimization**: Caching strategies, lazy evaluation, and efficient resource utilization

This packages directory delivers a complete, production-ready multi-language debugging ecosystem that abstracts away environmental complexity while providing robust, standards-compliant debugging capabilities through a unified interface and distribution model.
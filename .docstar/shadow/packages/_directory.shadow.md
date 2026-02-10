# packages/
@generated: 2026-02-10T21:27:52Z

## Overall Purpose and Responsibility

The `packages` directory serves as the complete implementation ecosystem for the MCP (Model Context Protocol) Debugger - a multi-language debugging platform that bridges various programming language debuggers with the Debug Adapter Protocol (DAP). This directory contains all the core components needed to provide unified debugging experiences across JavaScript/TypeScript, Python, Java, Go, and Rust, while maintaining protocol compliance and cross-platform compatibility.

## Key Components and System Integration

### Architectural Foundation
- **`shared/`**: Central foundational library providing core abstractions (`IDebugAdapter`, `AdapterPolicy`), factory patterns, registry systems, and standardized interfaces that ensure consistent behavior across all language adapters
- **Language-Specific Adapters**: Five production-ready debug adapter implementations, each handling the unique requirements of their target language ecosystem
- **CLI Distribution**: Complete build and runtime infrastructure transforming the TypeScript implementation into an npm-distributable CLI tool

### Language Adapter Ecosystem
The directory implements a comprehensive multi-language debugging solution:

- **`adapter-javascript/`**: JavaScript/TypeScript debugging via VS Code's vendored js-debug with intelligent runtime detection (Node.js, tsx, ts-node)
- **`adapter-python/`**: Python debugging through debugpy integration with cross-platform executable discovery and comprehensive environment validation
- **`adapter-java/`**: Java debugging bridging DAP with command-line jdb through protocol translation and process management
- **`adapter-go/`**: Go debugging leveraging Delve's native DAP support with comprehensive toolchain validation
- **`adapter-rust/`**: Rust debugging via CodeLLDB integration with Cargo project management and cross-platform binary analysis
- **`adapter-mock/`**: Testing framework providing configurable mock debugging for validation and development

### Component Integration Flow
```
CLI Entry → Shared Registry → Language Detection → Adapter Factory → Debug Session → Protocol Bridge → Native Debugger
```

1. **Registration Phase**: Language adapters register with the shared registry system using standardized factory patterns
2. **Discovery Phase**: Debug clients query available languages and capabilities through the unified API
3. **Instantiation Phase**: Factories create validated adapter instances with comprehensive environment checking
4. **Execution Phase**: DAP requests flow through language-specific adapters to native debugging tools
5. **Distribution Phase**: CLI packaging bundles all components into a single executable distribution

## Public API Surface

### Primary Entry Points

**CLI Distribution**:
- `@modelcontextprotocol/debugger`: Main npm package providing `npx` executable with all adapters bundled
- Protocol-compliant stdio/SSE transport support with automatic console management

**Core Interfaces** (from `shared/`):
- `IDebugAdapter`: Standard interface implemented by all language adapters
- `IAdapterRegistry` & `IAdapterFactory`: Adapter discovery and instantiation system
- `AdapterPolicy`: Language-specific behavior customization framework
- `DebugSession`: Unified session state management with dual-state architecture

**Language-Specific Factories**:
- `JavascriptAdapterFactory`: JavaScript/TypeScript debugging with Microsoft js-debug integration
- `PythonAdapterFactory`: Python debugging with debugpy and cross-platform executable discovery
- `JavaAdapterFactory`: Java debugging with jdb protocol translation
- `GoAdapterFactory`: Go debugging with Delve DAP integration
- `RustAdapterFactory`: Rust debugging with CodeLLDB and Cargo integration
- `MockAdapterFactory`: Configurable mock debugging for testing and development

### Configuration System
Each adapter supports language-specific launch configurations while maintaining DAP compliance:
- TypeScript runtime detection and ESM project analysis
- Python version validation and debugpy integration
- Java classpath management and JDB process control
- Go toolchain validation and Delve configuration
- Rust Cargo workspace management and binary format detection

## Internal Organization and Data Flow

### Layered Architecture
The packages follow a consistent three-layer pattern:
1. **Factory Layer**: Environment validation, dependency injection, and adapter instantiation
2. **Adapter Layer**: DAP protocol handling, lifecycle management, and native debugger coordination
3. **Utilities Layer**: Platform-specific executable discovery, version validation, and toolchain integration

### Cross-Platform Strategy
- Comprehensive Windows, macOS, and Linux support with platform-specific optimizations
- Container and proxy environment compatibility
- Intelligent executable discovery with fallback strategies
- Version compatibility validation and graceful degradation

### Performance and Reliability
- TTL-based caching for expensive operations (executable discovery, environment validation)
- Atomic build operations with rollback capabilities
- Comprehensive error handling with actionable user guidance
- Extensive test coverage with cross-platform validation

## Role in MCP Ecosystem

This packages directory represents the complete implementation of a production-ready multi-language debugging platform. It transforms the complexity of integrating with diverse native debugging tools (js-debug, debugpy, jdb, Delve, CodeLLDB) into a unified, protocol-compliant debugging experience. The system enables developers to debug applications across multiple languages through a single, consistent interface while preserving the full capabilities of each language's native debugging ecosystem.

The modular architecture allows for independent development and testing of language adapters while ensuring seamless integration through the shared foundational library, making it straightforward to add support for additional programming languages in the future.
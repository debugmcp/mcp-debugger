# packages/
@generated: 2026-02-12T21:06:51Z

## Overall Purpose and Responsibility

The `packages` directory contains the complete multi-language debug adapter ecosystem for the MCP (Model Context Protocol) debugger framework. This is a comprehensive debugging solution that provides production-ready debug adapters for multiple programming languages (JavaScript/TypeScript, Python, Go, Rust), unified under a shared architectural foundation with a batteries-included CLI distribution system.

## Key Components and System Architecture

The packages work together to form a cohesive debugging ecosystem with clear separation of concerns:

### Core Foundation
- **`shared/`**: Foundational contract layer providing interfaces (`IDebugAdapter`, `AdapterPolicy`), data models (`DebugSession`), factory patterns, and type definitions that ensure consistent architecture across all language adapters
- **`mcp-debugger/`**: Batteries-included CLI tool that bundles all debug adapters into a self-contained executable with MCP protocol compliance and automated distribution pipeline

### Language-Specific Debug Adapters
- **`adapter-javascript/`**: Production-ready JavaScript/TypeScript debugger wrapping Microsoft's js-debug with intelligent project detection and configuration transformation
- **`adapter-python/`**: Complete Python debugging solution integrating with debugpy, featuring cross-platform Python discovery and environment validation
- **`adapter-go/`**: Go debugging adapter leveraging Delve's native DAP support with sophisticated toolchain discovery
- **`adapter-rust/`**: Rust debugging solution using CodeLLDB with automated binary provisioning and Cargo integration
- **`adapter-mock/`**: Comprehensive testing infrastructure providing DAP-compliant mock debugging for system validation

### Integration Flow
1. **Shared Foundation**: All adapters implement standardized interfaces from the shared package
2. **Language-Specific Implementation**: Each adapter handles language-specific toolchain integration, environment discovery, and debugging protocol translation
3. **Factory-Based Creation**: Adapters use factory patterns with comprehensive environment validation and dependency checking
4. **Unified Distribution**: The mcp-debugger CLI bundles all adapters into a single, deployable debugging solution

## Public API Surface and Entry Points

### Primary Distribution
- **`mcp-debugger`**: Main CLI executable (`npx @debugmcp/mcp-debugger`) supporting multi-language debugging with automatic transport detection and MCP compliance

### Adapter Registry and Discovery
- **Global Adapter Registry**: `__DEBUG_MCP_BUNDLED_ADAPTERS__` provides runtime access to all bundled debugging adapters
- **Factory Pattern**: Each adapter exposes an `IAdapterFactory` implementation for standardized creation and validation
- **Language Detection**: Automatic adapter selection based on project type, file extensions, and environment analysis

### Supported Language Ecosystems
- **JavaScript/Node.js**: Full debugging with intelligent TypeScript support, ESM/CommonJS detection, and runtime discovery
- **Python**: Cross-platform Python 3.7+ debugging with debugpy integration and virtual environment support  
- **Go**: Native Delve DAP integration with Go 1.18+ support and comprehensive toolchain validation
- **Rust**: CodeLLDB-based debugging with Cargo project analysis and cross-platform binary provisioning
- **Testing/Mock**: Complete DAP-compliant mock debugging for development and testing scenarios

## Internal Organization and Data Flow

### Architectural Patterns
The packages implement several key patterns for consistency and reliability:

- **Factory Pattern**: Standardized adapter creation with environment validation and dependency injection
- **Policy Pattern**: Language-specific behaviors isolated in `AdapterPolicy` implementations
- **Event-Driven Architecture**: EventEmitter-based reactive debugging workflows with lifecycle management
- **Proxy Delegation**: Direct integration with native debug protocols (DAP, Delve, debugpy) minimizing translation overhead

### Environment Management
- **Cross-Platform Compatibility**: Comprehensive support for Windows, macOS, and Linux with platform-specific optimizations
- **Toolchain Discovery**: Intelligent detection of language runtimes, debuggers, and development tools with fallback mechanisms
- **Dependency Validation**: Pre-flight checks ensuring all required tools are available with actionable error messages
- **Caching Strategy**: TTL-based caching for expensive operations like executable discovery and version validation

### Build and Distribution Pipeline
- **Automated Vendoring**: Scripts automatically provision platform-specific debugging binaries (CodeLLDB, js-debug)
- **Multi-Stage Bundling**: Complete build system creating self-contained executables with embedded adapters
- **CI/CD Integration**: Environment-aware build processes with comprehensive testing and coverage enforcement

This packages directory represents a complete, production-ready debugging ecosystem that transforms multi-language development into a unified debugging experience through the MCP framework, combining sophisticated toolchain integration, robust error handling, and comprehensive cross-platform support.
# packages/
@children-hash: 99e493fb09a01468
@generated: 2026-02-15T09:02:37Z

## Overall Purpose and Responsibility

The `packages` directory contains the complete ecosystem of a multi-language debug adapter framework built around the Model Context Protocol (MCP) and Debug Adapter Protocol (DAP). This directory implements a comprehensive debugging solution that provides unified debugging capabilities across JavaScript, Python, Go, and Rust languages, along with shared infrastructure, testing utilities, and a batteries-included CLI tool. The framework enables seamless debugging experiences while maintaining protocol compliance, cross-platform compatibility, and extensible architecture.

## Key Components and System Integration

### Core Framework Architecture
The packages work together in a layered system with clear separation of concerns:

**Foundation Layer** (`shared/`):
- Provides the foundational contracts, interfaces, and type definitions for the entire debugging ecosystem
- Implements policy-based adapter architecture enabling language-specific customizations
- Establishes DAP protocol compliance standards and session lifecycle management
- Offers comprehensive testing infrastructure and dependency injection patterns

**Language Adapters** (`adapter-*`):
- **adapter-javascript**: Microsoft js-debug integration with sophisticated auto-configuration for ESM/CommonJS and TypeScript
- **adapter-python**: Complete Python debugging through debugpy with virtual environment detection
- **adapter-go**: Native Delve integration leveraging DAP protocol with comprehensive toolchain discovery
- **adapter-rust**: CodeLLDB-based debugging with Cargo integration and cross-platform binary analysis
- **adapter-mock**: Full DAP implementation for testing and development scenarios

**Distribution System** (`mcp-debugger`):
- Batteries-included CLI tool bundling all language adapters into deployable artifacts
- Protocol-compliant MCP server implementation with stdout protection
- Multi-format distribution (CLI, npm packages, platform-specific builds)
- Global adapter registry system for runtime adapter access

### Integration Patterns and Data Flow

1. **Shared Foundation**: All language adapters depend on `shared/` for contracts, type safety, and testing infrastructure
2. **Factory + Registry Pattern**: Centralized adapter discovery and instantiation through `IAdapterFactory` and `IAdapterRegistry`
3. **Policy-Based Customization**: Language-specific behavior implemented through pluggable policy interfaces
4. **Protocol Delegation**: Adapters leverage native debug engines (js-debug, debugpy, delve, CodeLLDB) rather than custom protocol implementations
5. **Bundled Distribution**: CLI tool statically includes all adapters eliminating runtime dependency issues

## Public API Surface and Entry Points

### Primary Framework Entry Points

**Shared Infrastructure** (`shared/`):
- `IDebugAdapter`: Core interface for implementing language-specific debug adapters
- `IAdapterFactory` and `IAdapterRegistry`: Standardized adapter lifecycle management
- Policy interfaces (`JsDebugAdapterPolicy`, `PythonAdapterPolicy`, etc.) for behavior customization
- `DebugSession`, launch/attach configurations, and comprehensive state management

**Language-Specific Adapters**:
- `JavascriptAdapterFactory` and `JavascriptDebugAdapter`: Auto-configuring JS/TS debugging with project detection
- `PythonAdapterFactory` and `PythonDebugAdapter`: Python debugging with environment discovery and debugpy integration
- `GoAdapterFactory` and `GoDebugAdapter`: Go debugging with native Delve DAP support
- `RustAdapterFactory` and `RustDebugAdapter`: Rust debugging through CodeLLDB with Cargo workspace support
- `MockAdapterFactory` and `MockDebugAdapter`: Complete DAP simulation for testing scenarios

**CLI Distribution** (`mcp-debugger`):
- Main CLI command accessible via npx with multi-transport support (stdio/SSE)
- Global adapter registry (`__DEBUG_MCP_BUNDLED_ADAPTERS__`) providing runtime access to all bundled adapters
- Build pipeline (`bundleCLI()`) for creating distribution artifacts

### Development and Integration APIs

**Environment Discovery**:
- Cross-platform executable resolution (`findPythonExecutable`, `findGoExecutable`, etc.)
- Toolchain validation and version compatibility checking
- Virtual environment and workspace detection

**Configuration Management**:
- Language-specific launch configurations with auto-detection capabilities
- Project analysis and build system integration (npm, Cargo, Go modules)
- Intelligent defaults with comprehensive fallback mechanisms

**Testing Infrastructure**:
- Mock implementations for all adapter interfaces
- Cross-platform testing utilities with environment simulation
- Comprehensive coverage validation across all language adapters

## Important Architectural Patterns

### Design Principles
- **Protocol Compliance First**: Strict DAP adherence with MCP compatibility
- **Language Agnostic Core**: Generic interfaces with language-specific extensions
- **Batteries-Included Philosophy**: Self-contained distributions eliminating external dependencies
- **Development-Friendly Defaults**: Zero-configuration debugging with intelligent auto-detection

### Quality Assurance Patterns
- **Comprehensive Testing**: Every package includes extensive unit and integration tests
- **Cross-Platform Validation**: Consistent behavior across Windows, macOS, and Linux
- **Mock-Based Isolation**: Reliable testing without external tool dependencies
- **Error Handling Excellence**: User-friendly error messages with specific installation guidance

### Performance and Reliability
- **Native Integration**: Leverages existing debug engines rather than custom protocol implementations
- **Intelligent Caching**: TTL-based caching for expensive operations (executable discovery, version detection)
- **Graceful Degradation**: Missing components generate warnings rather than failures
- **Resource Management**: Proper cleanup and lifecycle management for debug sessions

This packages directory represents a complete, production-ready debugging ecosystem that provides unified multi-language debugging capabilities while maintaining extensibility, reliability, and excellent developer experience across diverse development environments.
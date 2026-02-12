# packages/
@generated: 2026-02-11T23:48:51Z

## Overall Purpose and Responsibility

The `packages` directory serves as the complete **multi-language debugging ecosystem** for the MCP (Model Context Protocol) Debugger framework. This directory implements a modular architecture that provides Debug Adapter Protocol (DAP) compliant debugging capabilities for multiple programming languages while maintaining a unified, type-safe abstraction layer. The system transforms the complexity of language-specific debugging tools into a cohesive, production-ready debugging platform that integrates seamlessly with the MCP protocol infrastructure.

## Key Components and Integration Architecture

### Foundational Infrastructure
- **`shared/`** - Core type-safe abstraction layer providing unified interfaces (`IDebugAdapter`, `AdapterFactory`, `AdapterPolicy`) that establish architectural contracts for all language adapters
- **`mcp-debugger/`** - Standalone CLI distribution system that bundles all components into protocol-compliant, production-ready debugging tools for end-user deployment

### Language-Specific Adapters
- **`adapter-javascript/`** - Complete JavaScript/TypeScript debugging through VS Code's js-debug with automatic TypeScript runtime detection
- **`adapter-python/`** - Python debugging via debugpy integration with comprehensive virtual environment support  
- **`adapter-go/`** - Native Go debugging using Delve's built-in DAP protocol with cross-platform toolchain discovery
- **`adapter-rust/`** - Rust debugging through CodeLLDB backend with intelligent Cargo build system integration

### Testing and Development Infrastructure
- **`adapter-mock/`** - Comprehensive mock debug adapter for testing framework components and client development

## Component Integration Flow

The packages work together through a sophisticated orchestration pattern:

```
Shared Contracts → Language Adapters → Registry System → CLI Distribution → MCP Protocol
```

1. **Foundation Layer**: `shared/` establishes type-safe contracts and factory patterns
2. **Implementation Layer**: Language adapters implement shared interfaces while handling language-specific toolchain requirements
3. **Discovery Layer**: Registry system enables dynamic adapter discovery and instantiation
4. **Distribution Layer**: `mcp-debugger/` bundles everything into standalone CLI tools
5. **Protocol Layer**: MCP transport compliance ensures seamless integration with protocol infrastructure

## Public API Surface

### Primary Entry Points
- **`mcp-debugger/`** - Main CLI distribution (`debugmcp-*.tgz`) for npm/npx installation
- **Language Adapter Factories** - Standardized creation patterns:
  - `JavascriptAdapterFactory` - JavaScript/TypeScript debugging with automatic runtime detection
  - `PythonAdapterFactory` - Python debugging with environment validation (≥3.7, debugpy)
  - `GoAdapterFactory` - Go debugging with Delve integration and toolchain discovery
  - `RustAdapterFactory` - Rust debugging with CodeLLDB and Cargo build system support
- **`MockAdapterFactory`** - Testing infrastructure for framework development

### Shared Interfaces
- **`IDebugAdapter`** - Core debugging interface implemented by all language adapters
- **`AdapterFactory`** - Base factory with validation pipeline and dependency injection
- **`AdapterPolicy`** - Strategy pattern for language-specific debugging behaviors
- **Debug Entity Models** - `DebugSession`, `Breakpoint`, `Variable`, `StackFrame` with DAP compliance

## Internal Organization and Data Flow

### Unified Architecture Patterns
All adapters follow consistent architectural patterns established by the shared foundation:

- **Factory Pattern** - Standardized adapter creation with comprehensive environment validation
- **Strategy Pattern** - Language-specific policies while maintaining unified interfaces  
- **Event-Driven Design** - DAP protocol handling with state management and lifecycle tracking
- **Dependency Injection** - Pluggable components enabling testing and customization
- **Cross-Platform Abstraction** - Consistent behavior across Windows, macOS, and Linux

### Quality Assurance Standards
- **Comprehensive Testing** - Each package includes extensive unit and integration tests
- **Protocol Compliance** - Strict adherence to Debug Adapter Protocol standards
- **Error Handling** - Graceful degradation with user-friendly error messages
- **Performance Optimization** - Caching strategies and efficient toolchain discovery

## Critical Integration Points

### MCP Protocol Compliance
- Console output silencing for transport protocol compatibility
- Standardized adapter discovery through registry patterns
- Protocol-compliant bootstrapping and session management

### Multi-Language Support Strategy
- Native toolchain integration (Delve, debugpy, js-debug, CodeLLDB)
- Environment validation pipelines ensuring prerequisite availability
- Cross-platform executable discovery with intelligent caching
- Language-specific configuration with automatic runtime detection

### Production Deployment
- Self-contained CLI distributions with all runtime dependencies
- Platform-specific binary management and vendoring systems
- Graceful fallback mechanisms for missing optional dependencies
- CI/CD optimized build processes with offline development support

This packages directory represents a complete, production-ready debugging ecosystem that successfully bridges the gap between language-specific debugging tools and unified protocol-compliant debugging infrastructure, enabling seamless multi-language debugging workflows within the MCP framework.
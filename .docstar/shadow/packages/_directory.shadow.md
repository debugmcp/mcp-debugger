# packages/
@children-hash: 1c745d8d117536ab
@generated: 2026-02-21T08:29:44Z

## Overall Purpose and Responsibility

The `packages` directory contains the complete MCP (Model Context Protocol) debugger ecosystem - a comprehensive multi-language debugging platform that enables interactive debugging of MCP servers across JavaScript, Python, Go, Rust, and other languages. This directory houses both the foundational shared architecture and specialized language-specific debug adapters, culminating in a batteries-included CLI tool that provides seamless debugging capabilities through the Debug Adapter Protocol (DAP).

## Key Components and System Integration

### **Shared Foundation Layer (`shared/`)**
The architectural foundation providing:
- **Type-safe DAP abstraction layer** with comprehensive interface contracts (`IDebugAdapter`, `IAdapterFactory`, `IAdapterRegistry`)
- **Plugin-based architecture** enabling language-specific adapters through policy-driven design patterns
- **Dual-state session management** tracking both lifecycle and execution states
- **Dependency injection framework** with complete service abstractions for testing and production environments

### **Language-Specific Adapters**
Production-ready debug adapters for multiple ecosystems:

**`adapter-javascript/`**: Complete JavaScript/TypeScript debugging with intelligent environment detection, ESM/CommonJS support, and automated `vscode-js-debug` integration

**`adapter-python/`**: Comprehensive Python debugging via debugpy with virtual environment detection, framework support (Django/Flask), and cross-platform executable discovery

**`adapter-go/`**: Native Go debugging through Delve DAP integration, supporting applications, tests, executables, core dumps, and replay sessions with comprehensive toolchain validation

**`adapter-rust/`**: Full Rust debugging capabilities via CodeLLDB with cargo integration, binary analysis, cross-platform toolchain detection, and automated vendoring system

**`adapter-mock/`**: Complete DAP mock implementation for testing and development with configurable error scenarios and protocol compliance validation

### **Distribution and CLI (`mcp-debugger/`)**
The batteries-included CLI orchestrator that:
- **Bundles all adapters** into a single deployable tool eliminating runtime dependencies
- **Provides multiple distribution formats** (CLI executables, npm packages, platform-specific builds)
- **Ensures MCP protocol compliance** with comprehensive stdout protection and transport mode detection
- **Enables immediate debugging** across all supported languages without additional setup

## Public API Surface and Entry Points

### **Primary CLI Interface**
- **`npx @mcp-debugger/debugger`**: Main CLI entry point supporting stdio/SSE transport modes
- **Global adapter registry**: `__DEBUG_MCP_BUNDLED_ADAPTERS__` providing access to all language adapters
- **Multi-language support**: Immediate debugging for JavaScript, Python, Go, Rust, and mock scenarios

### **Shared Architecture APIs**
- **`IDebugAdapter`**: Core contract for implementing language-specific debugging
- **`AdapterPolicy`**: Interface for encapsulating language-specific behaviors
- **`DebugSession`**: Complete session state management with lifecycle tracking
- **Factory patterns**: `IAdapterFactory` and registry system for dynamic adapter discovery

### **Language-Specific Entry Points**
Each adapter package exports:
- **Adapter factory classes** with environment validation and dependency injection
- **Configuration interfaces** tailored to language-specific debugging requirements
- **Utility functions** for toolchain discovery and project analysis
- **Integration helpers** for seamless framework incorporation

## System Architecture and Data Flow

### **Development to Runtime Pipeline**
1. **Shared Foundation**: Common interfaces and abstractions enable consistent adapter development
2. **Language Adapters**: Specialized implementations leveraging native debugging tools (Delve, debugpy, js-debug, CodeLLDB)
3. **Build Integration**: Automated vendoring and bundling systems acquire external dependencies
4. **CLI Assembly**: Build orchestration creates batteries-included distribution with all adapters
5. **Runtime Bootstrap**: CLI establishes protocol compliance and populates adapter registry
6. **Debug Sessions**: Interactive debugging workflows access appropriate language adapters

### **Cross-Platform Excellence**
- **Environment Detection**: Sophisticated multi-tier discovery for language toolchains and debuggers
- **Platform Abstraction**: Unified APIs hiding OS-specific complexity (Windows, macOS, Linux)
- **Graceful Degradation**: Missing components generate warnings rather than failures
- **Self-Contained Distribution**: Vendored dependencies ensure consistent behavior across environments

## Key Design Patterns and Conventions

### **Architecture Patterns**
- **Plugin Architecture**: Language adapters integrate through shared interfaces enabling extensibility
- **Factory Pattern**: Centralized adapter creation with dependency injection and validation
- **Event-Driven Design**: EventEmitter-based communication for lifecycle management
- **Proxy Delegation**: Native debugging tool integration rather than custom protocol implementations

### **Quality and Reliability**
- **Comprehensive Testing**: Unit, integration, and cross-platform validation across all packages
- **Type Safety**: Extensive TypeScript usage with DAP protocol compliance
- **Error Handling**: Defensive programming with user-friendly error messages and troubleshooting guidance
- **Performance Optimization**: Caching strategies, lazy evaluation, and efficient resource management

The packages directory delivers a complete, production-ready multi-language debugging ecosystem that abstracts away toolchain complexity while providing robust, standards-compliant debugging capabilities through a unified interface. The batteries-included approach ensures immediate usability across development environments while maintaining extensibility for additional language support.
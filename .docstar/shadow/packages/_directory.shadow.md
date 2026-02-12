# packages/
@generated: 2026-02-12T21:02:08Z

## Overall Purpose and Responsibility

The `packages` directory constitutes the complete implementation of a comprehensive multi-language debugging ecosystem built on the Model Context Protocol (MCP) and Debug Adapter Protocol (DAP). This directory serves as the monorepo for a modular debugging framework that provides unified debugging experiences across JavaScript/TypeScript, Python, Go, and Rust programming languages while maintaining extensibility for additional language support.

The packages work together to create a batteries-included debugging solution that can operate both as a standalone CLI tool and as a protocol-compliant MCP service, enabling AI agents and development tools to perform sophisticated debugging operations across diverse technology stacks.

## Key Components and Integration Architecture

### Core Framework Layer
- **`shared`**: Foundational abstraction layer providing unified interfaces (`IDebugAdapter`, `IAdapterRegistry`), data models, factory patterns, and comprehensive testing infrastructure that serves as the contract for all language-specific implementations
- **`mcp-debugger`**: Primary distribution package that orchestrates the complete debugging CLI with MCP protocol compliance, adapter bundling, and cross-platform distribution

### Language-Specific Adapter Ecosystem
- **`adapter-javascript`**: Complete JavaScript/TypeScript debugging through integration with Microsoft's js-debug adapter, featuring automatic runtime detection, ESM/CommonJS support, and TypeScript toolchain integration
- **`adapter-python`**: Python debugging implementation using debugpy with comprehensive environment discovery, virtual environment support, and Django/Flask-specific configurations
- **`adapter-go`**: Go debugging adapter leveraging Delve's native DAP support with toolchain validation, cross-platform compatibility, and Go-specific debugging optimizations
- **`adapter-rust`**: Rust debugging integration through CodeLLDB with Cargo project management, binary format analysis, and cross-platform LLDB distribution
- **`adapter-mock`**: Comprehensive testing infrastructure providing DAP protocol simulation, error scenario testing, and development support across all adapter implementations

### Integration Flow Architecture
1. **Shared Foundation**: All adapters implement common interfaces from `shared`, ensuring consistent behavior and interoperability
2. **Factory Registration**: Language adapters register through factory patterns, enabling dynamic discovery and validation
3. **Protocol Orchestration**: `mcp-debugger` coordinates MCP/DAP protocol handling while adapters manage language-specific debugging logic
4. **Vendor Management**: Automated build systems handle complex dependency management (js-debug, CodeLLDB) across platforms
5. **Unified Distribution**: Complete packaging as npm-distributable CLI with embedded multi-language support

## Public API Surface and Entry Points

### Primary Distribution API
- **`@modelcontextprotocol/debugger` CLI**: Main entry point supporting `npx` execution, MCP transport modes (stdio/SSE), and protocol-compliant debugging operations
- **Adapter Factory Registry**: Dynamic adapter discovery through `IAdapterRegistry` with environment validation and capability detection

### Core Debugging Interfaces
- **`IDebugAdapter`**: Unified debugging contract implemented by all language adapters
- **`IAdapterFactory`**: Standardized creation pattern with environment validation and dependency checking
- **`DebugSession`**: Central session management with state tracking and configuration handling
- **`AdapterPolicy`**: Language-specific behavior customization through strategy pattern

### Language-Specific Entry Points
- **JavaScript/TypeScript**: `JavascriptAdapterFactory` with automatic runtime detection and configuration analysis
- **Python**: `PythonAdapterFactory` with comprehensive environment discovery and debugpy integration  
- **Go**: `GoAdapterFactory` with Delve DAP integration and toolchain validation
- **Rust**: `RustAdapterFactory` with CodeLLDB management and Cargo project support
- **Testing**: `MockAdapterFactory` with configurable behavior simulation and error scenario testing

## Internal Organization and Data Flow

### Modular Architecture Pattern
The packages follow a consistent layered architecture where `shared` provides foundational abstractions, language adapters implement specific debugging capabilities, and `mcp-debugger` orchestrates the complete experience. Each adapter follows the factory pattern with comprehensive validation, state management through event-driven transitions, and DAP protocol delegation to specialized debuggers.

### Cross-Package Dependencies
- All language adapters depend on `shared` for core interfaces and utilities
- `mcp-debugger` aggregates all adapters through a global registry pattern
- Build systems coordinate asset management and vendor distribution across packages
- Testing infrastructure leverages shared mock patterns and validation utilities

### Development and Distribution Flow
1. **Development**: Language adapters implement `shared` interfaces with comprehensive test coverage
2. **Build**: Automated scripts bundle vendor dependencies and create distributable packages  
3. **Integration**: `mcp-debugger` consolidates all components with protocol-compliant packaging
4. **Distribution**: Single npm package containing complete multi-language debugging capabilities

This packages directory represents a production-ready debugging ecosystem that bridges the gap between MCP protocol requirements and real-world multi-language debugging needs, providing both developer-friendly CLI tools and AI agent-compatible debugging services through a unified, extensible architecture.
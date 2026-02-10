# packages/
@generated: 2026-02-09T18:21:22Z

## Overall Purpose & Architecture

The `packages` directory contains the complete MCP (Model Context Protocol) Debugger ecosystem - a comprehensive multi-language debugging framework designed to provide unified debugging capabilities across different programming languages through a standardized Debug Adapter Protocol (DAP) interface. This modular architecture enables seamless integration with VS Code and other DAP-compatible editors while supporting diverse runtime environments.

## Component Integration & System Architecture

### Core Framework Foundation
The ecosystem is built upon the **`shared`** package, which provides:
- Universal TypeScript contracts and interfaces (`IDebugAdapter`, `IAdapterRegistry`, `AdapterFactory`)
- Language-agnostic debugging primitives and session management
- DAP protocol compliance framework with standardized state machines
- Dependency injection architecture enabling comprehensive testing and platform abstraction

### Language-Specific Adapter Ecosystem
Six specialized debugging adapters implement the shared framework contracts:

- **`adapter-go`**: Production-ready Go debugging via Delve (dlv) with native DAP support
- **`adapter-java`**: Java debugging through jdb with text-to-DAP protocol translation
- **`adapter-javascript`**: Node.js/TypeScript debugging using Microsoft's js-debug engine
- **`adapter-python`**: Python debugging via debugpy integration with comprehensive environment detection
- **`adapter-rust`**: Rust debugging through CodeLLDB with self-contained binary distributions
- **`adapter-mock`**: Testing and development adapter providing complete DAP simulation

### Distribution & Integration Layer
The **`mcp-debugger`** package serves as the unified distribution point:
- CLI tool providing batteries-included debugging capabilities
- MCP protocol compatibility with transport-aware output management
- Self-contained distributions including all platform-specific debugger binaries
- Global adapter registry coordinating all language-specific adapters

## Key Entry Points & Public API

### Primary Integration Points

**Factory Pattern Entry Points:**
- Each adapter exposes a `*AdapterFactory` implementing `IAdapterFactory` for environment validation and adapter creation
- Global registry system accessible through `mcp-debugger` for unified adapter management
- Standardized `createAdapter()`, `validate()`, and `getMetadata()` interfaces

**CLI & Distribution:**
- `npx @mcp/debugger` - Primary command-line interface with MCP protocol support
- Self-contained distributions eliminating external dependency management
- Platform-aware binary inclusion for cross-platform debugging scenarios

**Debug Session Management:**
- `IDebugAdapter` interface providing complete DAP protocol implementation
- Standardized lifecycle management (UNINITIALIZED → READY → CONNECTED → DEBUGGING)
- Configuration transformation from generic to language-specific parameters

### Cross-Language Debugging Capabilities

**Unified Feature Set:**
- Breakpoint management (function, conditional, exception where supported)
- Variable inspection and runtime evaluation
- Stack trace analysis and thread management
- Execution control (step, continue, pause, terminate)
- Multi-platform support (Windows, macOS, Linux with appropriate architectures)

**Language-Specific Extensions:**
- Go: Goroutine management and Delve-specific features
- Java: JDB integration with text parsing and process management
- JavaScript: ESM/CommonJS detection and TypeScript runtime support
- Python: Framework-aware debugging (Django, Flask) with multi-stage environment discovery
- Rust: CodeLLDB integration with Cargo project analysis and binary format detection

## Integration Flow & Data Architecture

### Initialization & Environment Detection
1. **Factory Validation**: Each adapter validates language-specific prerequisites (runtime versions, debugger availability, toolchain presence)
2. **Registry Population**: Global registry discovers and validates all available adapters
3. **Configuration Resolution**: Generic debug configurations transformed to adapter-specific formats
4. **Session Instantiation**: Adapters created with validated environments and dependency injection

### Runtime Debugging Workflow
1. **Protocol Bridging**: Adapters translate DAP requests to language-specific debugger commands
2. **Process Management**: Abstract process layer handles target application launching and debugger attachment
3. **State Synchronization**: Dual state tracking (lifecycle and execution) with event-driven updates
4. **Communication Coordination**: Bidirectional event flow between DAP clients and language debuggers

### Quality Assurance & Testing
- Comprehensive test suites with mock-based external dependency simulation
- Cross-platform testing through environment simulation and platform abstraction
- Interactive coverage reporting with high coverage thresholds (90%+)
- Integration testing validating complete debugging workflows end-to-end

## Design Patterns & Architectural Principles

### Standardization & Extensibility
- **Factory Pattern**: Uniform adapter creation with comprehensive validation
- **Strategy Pattern**: Language-specific behavior encapsulation through policy classes
- **Dependency Injection**: Complete abstraction of external dependencies enabling hermetic testing
- **Event-Driven Architecture**: Decoupled components communicating through standardized event interfaces

### Reliability & Cross-Platform Compatibility
- **Multi-Stage Fallback**: Robust environment detection with graceful degradation
- **Self-Contained Distribution**: Zero external dependency requirement with vendored binaries
- **Platform Abstraction**: Consistent API surface across all supported operating systems
- **MCP Protocol Compliance**: Transport-aware operation ensuring compatibility with AI system integration

This packages directory provides a complete, production-ready debugging solution that bridges the gap between diverse programming language ecosystems and modern protocol-based development environments, enabling seamless debugging integration within MCP-compatible AI systems and traditional development workflows.
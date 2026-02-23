# src/
@children-hash: 321744b3621cc3b3
@generated: 2026-02-23T15:27:11Z

## Purpose and Responsibility

The `src` directory contains the complete implementation of Debug MCP Server - a step-through debugging server for Large Language Models using the Model Context Protocol (MCP). This directory serves as the main source tree that provides multi-language debugging capabilities (Python, JavaScript, Rust, Go) through a unified MCP interface, supporting both stdio and Server-Sent Events transports with comprehensive session management and Debug Adapter Protocol (DAP) integration.

## Architecture and Component Integration

The source tree follows a layered architecture with clear separation of concerns:

### Core Server Layer (`index.ts`, `server.ts`)
- **Entry Point**: `index.ts` handles critical initialization, console output silencing for protocol safety, and CLI command routing
- **Main Server**: `server.ts` implements the primary `DebugMcpServer` class with 18 MCP tools for debug operations, language discovery, and session orchestration

### Transport and CLI Layer (`cli/`)
- Provides multiple transport modes (stdio, SSE) with robust error handling and containerized environment support
- Implements comprehensive CLI framework with standardized logging, graceful shutdown, and specialized Rust binary analysis utilities
- Maintains transport protocol safety through explicit console output silencing

### Dependency Injection and Configuration (`container/`)
- Centralized bootstrapping that wires together all application dependencies through type-safe configuration interfaces
- Creates complete production dependency graph with environment-aware initialization and dynamic adapter loading

### Session Management Layer (`session/`)
- **SessionManager**: Primary orchestrator for debug session lifecycle from creation through termination
- **SessionStore**: Pure data management with UUID-based session identification and language policy selection
- Provides unified interface for multi-language debugging while maintaining language-specific behavior through adapter policies

### Debug Adapter Protocol Integration (`dap-core/`, `proxy/`)
- **DAP Core**: Functional, stateless DAP processing engine with pure state management and effect-as-data patterns
- **Proxy System**: Comprehensive proxy infrastructure that bridges MCP clients with language-specific debug adapters
- Handles complex multi-session scenarios (JavaScript parent-child debugging) and policy-driven adapter behavior

### Language Adapter Management (`adapters/`)
- Dynamic adapter discovery, loading, and lifecycle management for pluggable debugger support
- Multi-tier resolution strategy with robust fallback mechanisms and auto-dispose functionality
- Supports both installed packages and development environments

### Infrastructure and Utilities
- **Interfaces** (`interfaces/`): Core abstraction layer defining TypeScript contracts for dependency injection and system integration
- **Implementations** (`implementations/`): Production-ready concrete implementations bridging domain interfaces with Node.js platform APIs
- **Utilities** (`utils/`): Cross-environment compatibility, path resolution, error handling, and data validation infrastructure
- **Error System** (`errors/`): Comprehensive typed error hierarchy extending MCP SDK with debugger-specific semantic errors

## Public API Surface and Key Entry Points

### Main Server Interface
- **`createDebugMcpServer(options: ServerOptions)`**: Factory function for server instances with configurable logging
- **18 MCP Tools**: Complete debug operation suite including session management, execution control, variable inspection, and expression evaluation

### CLI Commands
- **stdio mode**: Primary MCP protocol over stdio transport (default)
- **sse mode**: HTTP-based Server-Sent Events transport with multi-client support
- **check-rust-binary**: Specialized utility for Rust binary debugging analysis

### Session Management API
- **`createSession(language, name?, executablePath?)`**: Multi-language session initialization
- **Debug Control**: `startDebugging()`, `stepOver/Into/Out()`, `continue()`, `setBreakpoint()`
- **Data Access**: `getVariables()`, `getStackTrace()`, `evaluateExpression()`
- **Process Operations**: `attachToProcess()`, `detachFromProcess()`

### Language Support
- **Supported Languages**: Python, JavaScript (Node.js), Rust, Go, Mock (testing)
- **Dynamic Discovery**: Runtime language detection with executable resolution
- **Adapter Management**: Pluggable adapter system with auto-loading and lifecycle management

## Data Flow and Integration Patterns

### Request Processing Flow
1. **MCP Client** → **Transport Layer** (stdio/SSE) → **DebugMcpServer**
2. **Server** → **SessionManager** → **ProxyManager** → **Language Adapter**
3. **Debug Adapter** (DAP) ↔ **Proxy System** ↔ **Target Process**

### Multi-Language Architecture
- **Policy-Based Behavior**: Language-specific behavior through adapter policies rather than hardcoded logic
- **Unified Interface**: Single MCP API surface regardless of target language
- **Session Isolation**: Independent session management with concurrent debugging support

### Environment Adaptability
- **Container Support**: Automatic detection and path resolution for Docker/containerized deployments
- **Development vs Production**: Flexible adapter loading supporting both development monorepos and production installations
- **Cross-Platform**: Node.js-based implementation with platform-specific process management

## Key Design Patterns

- **Dependency Injection**: Comprehensive DI throughout for testability and modularity
- **Factory Pattern**: Centralized object creation with configurable dependencies
- **Event-Driven Architecture**: Session lifecycle and adapter communication through events
- **Functional Core/Imperative Shell**: Pure business logic with side effects at boundaries
- **Policy-Driven Design**: Language-specific behavior through configurable policies rather than inheritance

The source directory represents a complete, production-ready debugging framework that enables LLMs to perform sophisticated step-through debugging across multiple programming languages through a standardized MCP interface, while maintaining robust error handling, comprehensive testing support, and flexible deployment options.
# src/
@children-hash: 7ace98d1ba51f163
@generated: 2026-02-23T19:01:02Z

## Overall Purpose and Responsibility

The `src` directory contains the complete implementation of a Debug MCP (Model Context Protocol) Server - a multi-language debugging system that provides step-through debugging capabilities for LLMs through the Model Context Protocol. This directory serves as the main application layer, implementing a pluggable debugging architecture that supports Python, JavaScript, Rust, Go, and extensible language adapters through a unified DAP (Debug Adapter Protocol) proxy system.

## Key Components and Integration

### Core Server Infrastructure
The **main entry point** (`index.ts`) and **primary server implementation** (`server.ts`) form the foundation, handling:
- Console output silencing for MCP protocol compatibility
- 18 MCP tools for session management, breakpoints, stepping, and variable inspection
- Multi-transport support (stdio, SSE) through the CLI layer
- Container-aware deployment with Docker volume mount support

### Multi-Layer Architecture
The system follows a clean architectural separation:

1. **Interface Layer** (`interfaces/`): TypeScript contracts for dependency injection and system boundaries
2. **Implementation Layer** (`implementations/`): Node.js-specific implementations of file system, process management, and network operations
3. **Domain Logic Layer**: Session management (`session/`), proxy orchestration (`proxy/`), and DAP processing (`dap-core/`)
4. **Infrastructure Layer**: Error handling (`errors/`), utilities (`utils/`), and dependency injection (`container/`)

### Debug Session Orchestration
The **SessionManager** coordinates the complete debug session lifecycle:
- Creates and manages debug sessions through the `session/` module
- Spawns language-specific proxy processes via the `proxy/` system
- Handles DAP communication through functional state management in `dap-core/`
- Supports complex multi-session scenarios (JavaScript parent-child debugging)

### Pluggable Language Support
The **adapter system** (`adapters/`) provides dynamic language support:
- Runtime discovery and loading of language adapters
- Factory pattern with caching and lifecycle management
- Policy-driven behavior for language-specific debugging requirements
- Standardized package naming conventions (`@debugmcp/adapter-{language}`)

### Proxy Architecture
The **proxy system** (`proxy/`) bridges MCP clients and debug adapters:
- Multi-session management for complex debugging scenarios
- Policy-based adapter configuration eliminating language-specific hardcoding
- Robust process management with orphan detection and container awareness
- DAP protocol extensions for enhanced debugging capabilities

## Public API Surface

### Primary Entry Points
- **`createDebugMcpServer(options?: ServerOptions)`**: Main factory function for server instances
- **CLI Commands**: `stdio`, `sse`, and `check-rust-binary` commands through the CLI layer
- **MCP Tools**: 18 debugging tools including `create_debug_session`, `start_debugging`, `step_over`, `get_variables`, etc.

### Configuration Interfaces
- **ServerOptions**: Core server configuration (logLevel, logFile)
- **ProxyConfig**: Language-agnostic proxy configuration
- **ContainerConfig**: Dependency injection container setup

### Session Management API
- Session lifecycle: `createSession()`, `startDebugging()`, `closeSession()`
- Debug operations: `stepOver()`, `stepInto()`, `stepOut()`, `continue()`, `setBreakpoint()`
- Data inspection: `getVariables()`, `getStackTrace()`, `evaluateExpression()`

## Internal Organization and Data Flow

### Initialization Flow
1. **Bootstrap**: Entry point silences console output and sets up CLI
2. **Dependency Injection**: Container creates production dependency graph
3. **Server Creation**: MCP server initialized with debug tools and session management
4. **Transport Setup**: CLI configures stdio or SSE transport for MCP communication

### Debug Session Flow
1. **Session Creation**: Client requests session via MCP tool
2. **Language Discovery**: Adapter registry resolves language-specific debug adapter
3. **Proxy Spawning**: ProxyManager creates isolated proxy process for DAP communication
4. **Debug Launch**: SessionManager orchestrates debug target startup and adapter connection
5. **Runtime Operations**: DAP commands flow through proxy to debug adapter with state management

### Cross-Cutting Concerns
- **Error Handling**: Structured error hierarchy with semantic error types
- **Path Resolution**: Container-aware path handling for Docker environments
- **Logging**: Winston-based logging with namespace isolation and console output silencing
- **Process Management**: Robust process lifecycle with cleanup and orphan detection

## Important Patterns and Conventions

### Functional Core, Imperative Shell
- Pure functional state management in `dap-core` with immutable state transitions
- Imperative process management and I/O operations in outer layers
- Clear separation between business logic and infrastructure concerns

### Dependency Injection Throughout
- Comprehensive DI container supporting testing and modularity
- Factory pattern for complex object creation
- Interface segregation enabling clean boundaries

### Transport Protocol Safety
- Explicit console output silencing prevents MCP protocol corruption
- Environment variable coordination for multi-process communication
- Robust error handling with structured logging instead of console output

### Container-First Design
- Environment detection and path resolution for Docker deployment
- Keep-alive mechanisms for containerized environments
- Workspace root handling for volume mount scenarios

This directory represents a production-ready, multi-language debugging system designed for LLM integration through the Model Context Protocol, with comprehensive support for modern development environments including containerized deployments.
# (root)/
@children-hash: 24c2e3a4b36b591d
@generated: 2026-02-24T01:56:47Z

## Overall Purpose and Architecture

This is the complete **Debug MCP Server** project - a production-ready Model Context Protocol (MCP) server that provides standardized debugging capabilities across multiple programming languages (Python, JavaScript/TypeScript, Rust, Go). The project implements a comprehensive debugging framework that bridges MCP clients with language-specific debug adapters through the Debug Adapter Protocol (DAP), enabling step-through debugging, breakpoint management, variable inspection, and expression evaluation in a unified interface.

The system follows a **layered monorepo architecture** with clear separation between core framework, language adapters, development tooling, and deployment infrastructure. At its heart, the project transforms traditional debugging tools into MCP-compliant services that can be consumed by AI agents and modern development environments.

## Core System Components

### MCP Server Implementation (`src/`)
The main server implementation provides 18 registered MCP tools for debugging operations, handling session lifecycle management, multi-transport support (stdio, SSE), and protocol safety through console output silencing. The architecture uses dependency injection, event-driven communication, and functional core patterns to ensure reliability and testability.

### Language Adapter Framework (`packages/`)
A complete ecosystem of debug adapters supporting JavaScript/TypeScript (vscode-js-debug), Python (debugpy), Go (Delve), Rust (CodeLLDB), and mock implementations. Each adapter handles language-specific complexities while providing a unified `IDebugAdapter` interface. The framework includes intelligent project detection, cross-platform toolchain validation, and sophisticated vendoring systems for debug engines.

### Development and Testing Infrastructure (`tests/`, `examples/`)
Comprehensive quality assurance through 5-tier testing (unit, integration, e2e, stress, manual) with extensive mock infrastructure and cross-platform validation. The examples directory provides educational demonstrations, autonomous debugging agents, and rich terminal UI visualizations for both validation and user education.

### Operational Tooling (`scripts/`, `docker/`)
Complete automation for build processes, CI/CD pipelines, cross-platform setup, and deployment. Includes Docker containerization, bundle optimization, dependency management, GitHub Actions integration, and platform-specific configuration tools.

## Public API and Integration Points

### Primary Entry Points
- **CLI Interface**: `debug-mcp-server` command with stdio (default) and SSE transport modes
- **NPM Package**: `@debugmcp/mcp-debugger` for global installation and programmatic use  
- **Docker Container**: `debugmcp/mcp-debugger:latest` for containerized deployment
- **Python Launcher**: `mcp_debugger_launcher` package for intelligent runtime detection

### MCP Tools API (18 tools)
**Session Management**: `create_debug_session`, `list_debug_sessions`, `close_debug_session`
**Process Control**: `start_debugging`, `attach_to_process`, `detach_from_process`  
**Execution Control**: `step_over`, `step_into`, `step_out`, `continue_execution`, `pause_execution`
**Data Inspection**: `get_variables`, `get_local_variables`, `get_stack_trace`, `get_scopes`
**Advanced Operations**: `evaluate_expression`, `get_source_context`, `set_breakpoint`
**Discovery**: `list_supported_languages`

### Integration Interfaces
- **Language Factories**: Pluggable adapter system with environment validation and project detection
- **Transport Abstraction**: Unified server implementation across stdio and HTTP/SSE protocols
- **Cross-Platform Support**: Comprehensive Windows/Linux/macOS compatibility with intelligent toolchain discovery

## Data Flow and System Integration

### Debug Session Lifecycle
1. **Initialization**: MCP client creates session → SessionManager coordinates → AdapterRegistry provides language adapter
2. **Runtime Orchestration**: ProxyManager spawns worker process → DAP connection established → Debug target launched
3. **Command Processing**: Debug operations flow through MCP protocol → Session management → DAP proxy → Language adapter
4. **State Management**: Variable/stack inspection processed through functional DAP core → Results returned via MCP
5. **Cleanup**: Session termination triggers cascading resource cleanup across all system layers

### Multi-Environment Deployment
The system seamlessly operates across development (local Node.js), containerized (Docker), and distributed (NPM global) environments through intelligent runtime detection, path resolution, and dependency management. The Python launcher provides universal deployment capabilities with automatic fallback between NPM and Docker execution modes.

## Key Design Patterns and Conventions

### Protocol Safety and Reliability
Critical console output silencing prevents stdout pollution that corrupts MCP protocol communication. The system implements comprehensive error handling with structured error hierarchies, graceful degradation patterns, and environment-specific troubleshooting guidance.

### Extensible Architecture  
The adapter plugin system enables seamless addition of new programming languages through standardized interfaces. Factory patterns with dependency injection ensure testability and modularity while supporting both production and mock implementations for development.

### Production Readiness
Comprehensive CI/CD automation, cross-platform testing, Docker containerization, performance optimization through esbuild bundling, and sophisticated resource management ensure the system meets enterprise deployment requirements.

This project represents a complete debugging ecosystem that successfully bridges modern MCP protocol requirements with traditional debugging tools while maintaining clean architecture, comprehensive error handling, and multi-environment compatibility.
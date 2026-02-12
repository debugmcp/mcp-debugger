# (root)/
@generated: 2026-02-12T21:07:31Z

## Overall Purpose and Responsibility

The root directory contains the complete **debugMCP** project - a sophisticated multi-language debugging platform that bridges AI agents with debugging capabilities through the Model Context Protocol (MCP). This system transforms traditional debugging into an AI-accessible service by providing programmatic debugging operations for Python, JavaScript/TypeScript, Go, and Rust applications through a unified MCP server interface.

## Key Components and System Architecture

The project implements a comprehensive debugging ecosystem organized into several interconnected modules:

### Core MCP Debugging Server (`src/`)
The central MCP server exposes 16 debugging tools (session management, execution control, inspection, evaluation) through standardized MCP protocol. Features complete debug session lifecycle management, DAP proxy system with process isolation, dynamic language adapter discovery, and support for both stdio and HTTP/SSE transports.

### Multi-Language Debug Adapters (`packages/`)
Production-ready debug adapter ecosystem supporting JavaScript/TypeScript (js-debug), Python (debugpy), Go (Delve), and Rust (CodeLLDB). Each adapter provides intelligent toolchain discovery, environment validation, and seamless integration with native debugging protocols. The `mcp-debugger` CLI bundles all adapters into a self-contained executable.

### Comprehensive Testing Infrastructure (`tests/`)
Four-tier validation system encompassing unit tests, integration testing, end-to-end workflows, and specialized stress testing. Validates MCP protocol compliance, DAP compatibility, cross-platform functionality, and production deployment scenarios across all supported languages.

### Development and Demo Ecosystem (`examples/`)
Rich collection of demonstration materials including live terminal visualization, autonomous debugging agents, interactive debugging workflows, and educational programming examples across all supported languages. Serves as both learning resources and integration validation.

### Build and Deployment Automation (`scripts/`)
Complete development workflow automation including build pipelines, Docker integration, testing orchestration, environment setup, and deployment helpers. Supports cross-platform development with sophisticated CI/CD integration.

### Distribution Infrastructure
Multiple deployment mechanisms including Docker containerization (`docker/`), Python launcher package (`mcp_debugger_launcher/`), and NPM distribution with intelligent runtime detection and fallback strategies.

## Public API Surface and Key Entry Points

### Primary MCP Server Interface
- **Main Executable**: `npx @debugmcp/mcp-debugger` or `mcp-debugger-launcher` (Python)
- **Transport Modes**: STDIO (default for Claude integration) and SSE (port 3001 for HTTP clients)
- **Core MCP Tools**: 16 debugging operations including `create_debug_session`, `start_debugging`, `step_over`, `get_variables`, `evaluate_expression`, `get_stack_trace`

### Language Support Matrix
- **JavaScript/TypeScript**: Node.js debugging with intelligent project detection and source map support
- **Python**: Cross-platform Python 3.7+ debugging with virtual environment compatibility
- **Go**: Native Delve DAP integration with Go 1.18+ toolchain validation
- **Rust**: CodeLLDB-based debugging with automated binary provisioning and Cargo integration

### Integration APIs
- **MCP Protocol Compliance**: Full Model Context Protocol server with tool registration and bidirectional communication
- **DAP Integration**: Debug Adapter Protocol proxy system with multi-session support and process isolation
- **CLI Framework**: Comprehensive command-line interface with transport detection and environment adaptation

## Internal Organization and Data Flow

### Architectural Patterns
The system employs several key architectural patterns:
- **Dependency Injection**: Complete IoC container system enabling testability and modularity
- **Process Isolation**: Debug adapters run in separate proxy processes preventing crashes
- **Factory Pattern**: Standardized adapter creation with environment validation
- **Event-Driven Architecture**: DAP communication through EventEmitter-based reactive workflows
- **Protocol Abstraction**: Clean separation between MCP server layer and language-specific debugging implementations

### Data Flow Pipeline
1. **Client Connection**: MCP clients connect via stdio or SSE transport to the debug server
2. **Tool Invocation**: AI agents invoke debugging tools through standardized MCP protocol
3. **Session Management**: Server creates and manages debug sessions with lifecycle tracking
4. **Adapter Selection**: Dynamic discovery and instantiation of appropriate language debug adapters
5. **DAP Communication**: Proxy processes handle Debug Adapter Protocol communication with native debuggers
6. **State Synchronization**: Debug state and results flow back through the MCP protocol to clients

### Cross-Platform Compatibility
The system provides comprehensive cross-platform support with Windows, macOS, and Linux compatibility, container-aware path resolution, platform-specific binary provisioning, and intelligent toolchain discovery with fallback mechanisms.

## Critical Integration Points

### Development Workflow Integration
- **IDE Support**: Designed for Claude Code and other MCP-compatible development environments
- **CI/CD Integration**: Docker-based deployment with automated testing and validation
- **Local Development**: Rich terminal UIs and live visualization tools for debugging workflow development

### Protocol Compliance
- **MCP Specification**: Full compliance with Model Context Protocol for AI agent integration
- **DAP Standards**: Debug Adapter Protocol compliance ensuring compatibility with standard debugging tools
- **Transport Flexibility**: Support for both stdio and HTTP/SSE transports adapting to different client requirements

This root directory represents a complete, production-ready debugging platform that successfully bridges the gap between AI agents and traditional debugging tools, enabling sophisticated programmatic debugging workflows across multiple programming languages through a unified, protocol-compliant interface.
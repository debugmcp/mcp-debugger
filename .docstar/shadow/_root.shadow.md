# (root)/
@children-hash: 24e9a5ea957504d4
@generated: 2026-02-21T20:49:30Z

## Overall Purpose and Responsibility

This repository contains **Debug MCP Server** - a comprehensive Model Context Protocol (MCP) implementation that enables AI agents to perform interactive debugging across multiple programming languages (Python, JavaScript/TypeScript, Go, Rust). The system bridges AI agents with native debugging tools through standardized MCP tools, providing step-through debugging, variable inspection, expression evaluation, and session management capabilities.

## Key System Architecture and Component Integration

### Core Server Infrastructure (`src/`)
The heart of the system is a production-ready MCP server that exposes 16 standardized debugging tools through JSON-RPC protocol. The server orchestrates debug sessions through a sophisticated proxy system that communicates with language-specific debug adapters via the Debug Adapter Protocol (DAP).

### Multi-Language Debug Adapters (`packages/`)
A complete ecosystem of language-specific debugging capabilities:
- **Shared Foundation**: Type-safe DAP abstraction layer with plugin architecture
- **Language Adapters**: Production implementations for JavaScript (vscode-js-debug), Python (debugpy), Go (Delve), Rust (CodeLLDB), and mock testing
- **Batteries-Included CLI**: Single executable bundling all adapters with automatic runtime detection

### Comprehensive Testing Infrastructure (`tests/`)
Multi-layered validation framework covering unit tests through end-to-end integration across all supported languages, transport protocols (stdio, SSE), and deployment scenarios (Docker, npm).

### Development and Deployment Tooling
- **Build System (`scripts/`)**: Cross-platform automation for bundling, Docker containerization, validation, and CI/CD workflows
- **Configuration**: Modern ESLint/TypeScript setup with comprehensive test runner configuration
- **Examples**: Educational demonstrations and integration testing across all supported languages
- **Launcher (`mcp_debugger_launcher/`)**: Python-based intelligent launcher with runtime detection

## Public API Surface and Entry Points

### Primary MCP Tools API
The server exposes 16 core debugging operations through MCP protocol:
- **Session Management**: `create_debug_session`, `list_debug_sessions`, `close_debug_session`
- **Execution Control**: `start_debugging`, `step_over`, `step_into`, `step_out`, `continue_execution`, `pause_execution`
- **State Inspection**: `get_variables`, `get_local_variables`, `get_stack_trace`, `get_scopes`, `get_source_context`
- **Dynamic Evaluation**: `evaluate_expression`
- **Discovery**: `list_supported_languages`

### Distribution and Access Points
- **CLI Entry**: `npx @debugmcp/mcp-debugger` - Batteries-included executable supporting stdio/SSE transport modes
- **Python Launcher**: `mcp_debugger_launcher` - Intelligent runtime detection and server lifecycle management
- **Docker Integration**: Production containerization with development debugging capabilities
- **IDE Integration**: Native Claude Code integration with automated MCP transport setup

### Developer Integration APIs
- **Server Factory**: `createDebugMcpServer(options)` for programmatic server creation
- **Adapter System**: Extensible plugin architecture for additional language support
- **Configuration**: Comprehensive environment detection and toolchain validation

## System Data Flow and Orchestration

### End-to-End Debugging Workflow
1. **Initialization**: AI agent connects to MCP server via stdio or SSE transport
2. **Session Creation**: Agent creates debug session specifying target language and program
3. **Adapter Selection**: System automatically selects appropriate debug adapter (Python/debugpy, JS/vscode-js-debug, etc.)
4. **Proxy Establishment**: DAP proxy bridges MCP protocol with language-specific debugging backend
5. **Interactive Debugging**: Agent performs debugging operations through MCP tools, translated to DAP commands
6. **State Management**: Session maintains execution state, variable data, and stack information
7. **Cleanup**: Graceful session termination with resource cleanup

### Cross-Platform Excellence
The system provides consistent debugging experience across Windows, macOS, and Linux through:
- **Intelligent Runtime Detection**: Automatic discovery of language toolchains and debuggers
- **Containerized Deployment**: Docker support for consistent environments
- **Environment Abstraction**: Unified APIs hiding platform-specific complexity
- **Graceful Degradation**: Missing components generate warnings rather than failures

## Key Design Patterns and Architectural Decisions

### Protocol-First Architecture
- **MCP Compliance**: Full adherence to Model Context Protocol standards with transport mode safety
- **DAP Integration**: Native Debug Adapter Protocol support enabling leverage of existing debugging ecosystems
- **Type Safety**: Comprehensive TypeScript implementation with runtime validation

### Production-Ready Quality
- **Comprehensive Testing**: Multi-layer validation from unit tests through cross-platform integration
- **Resource Management**: Proper session lifecycle, process cleanup, and resource tracking
- **Error Resilience**: Graceful handling of failures with detailed error reporting and recovery strategies
- **Performance Optimization**: Efficient proxy communication, connection pooling, and resource allocation

### Developer Experience Focus
- **Zero-Configuration**: Intelligent defaults with automatic environment detection
- **Educational Resources**: Comprehensive examples and demonstrations across all supported languages
- **Extensible Design**: Plugin architecture enabling community contributions and additional language support
- **Rich Diagnostics**: Detailed logging, status reporting, and troubleshooting guidance

This repository delivers a complete, production-ready multi-language debugging platform that abstracts away toolchain complexity while providing robust, standards-compliant debugging capabilities through a unified MCP interface, enabling AI agents to perform sophisticated debugging operations across diverse programming environments.
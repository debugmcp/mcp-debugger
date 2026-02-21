# (root)/
@children-hash: 1866dc8ea6965d98
@generated: 2026-02-21T08:30:20Z

## Overall Purpose and Responsibility

This is the root directory of **Debug MCP** - a comprehensive Model Context Protocol (MCP) server that enables AI agents to perform interactive debugging across multiple programming languages. The system bridges AI agents with native debugging tools (debugpy, js-debug, Delve, CodeLLDB) through a standardized MCP protocol, providing step-through debugging capabilities for Python, JavaScript/TypeScript, Go, and Rust applications.

## Key Components and System Architecture

### Core Distribution and Entry Points
- **mcp-debugger-wrapper.sh**: Primary executable wrapper that intelligently detects transport modes and routes to Node.js distribution
- **src/**: Complete MCP server implementation exposing 16 debugging tools through JSON-RPC protocol
- **packages/**: Multi-language debug adapter ecosystem with shared architecture and language-specific implementations
- **mcp_debugger_launcher/**: Python CLI launcher providing intelligent runtime detection and cross-platform deployment

### Multi-Language Debug Adapter System
- **Language Adapters** (`packages/adapter-*`): Production-ready adapters for JavaScript/TypeScript, Python, Go, and Rust with native toolchain integration
- **Shared Foundation** (`packages/shared/`): Type-safe DAP abstraction layer enabling consistent adapter development through plugin architecture
- **Unified CLI** (`packages/mcp-debugger/`): Batteries-included distribution bundling all adapters for immediate cross-language debugging

### Development and Testing Infrastructure
- **Comprehensive Test Suite** (`tests/`): Four-tier validation (unit, integration, end-to-end, specialized) ensuring production reliability across all languages and platforms
- **Rich Examples** (`examples/`): Educational resources and validation scenarios demonstrating debugging workflows across programming languages
- **Build Automation** (`scripts/`): Cross-platform development tooling for building, testing, packaging, and deployment
- **Container Support** (`docker/`): Containerized development environment with integrated debugging capabilities

## Public API Surface and Entry Points

### Primary User Interfaces
- **CLI Entry Point**: `mcp-debugger-wrapper.sh` or `npx @debugmcp/mcp-debugger` providing stdio/SSE transport modes
- **MCP Tools API**: 16 standardized debugging operations:
  - **Session Management**: `create_debug_session`, `list_debug_sessions`, `close_debug_session`
  - **Execution Control**: `start_debugging`, `step_over`, `step_into`, `step_out`, `continue_execution`, `pause_execution`
  - **Data Inspection**: `get_variables`, `get_local_variables`, `get_stack_trace`, `get_scopes`, `get_source_context`
  - **Code Evaluation**: `evaluate_expression`
  - **Capability Discovery**: `list_supported_languages`

### Integration Interfaces
- **MCP Protocol Compliance**: JSON-RPC 2.0 communication over stdio or Server-Sent Events
- **Debug Adapter Protocol**: Native integration with language-specific debugging tools
- **Cross-Platform Deployment**: NPM packages, Docker containers, and standalone executables
- **Multi-Runtime Support**: Automatic detection and coordination of Node.js, Python, Docker execution environments

## System Integration and Data Flow

### Architecture Pattern
The system employs a **layered plugin architecture** with clear separation of concerns:

```
AI Agents → MCP Protocol → Debug MCP Server → Language Adapters → Native Debug Tools → Target Applications
```

### Initialization and Discovery Flow
1. **Runtime Detection**: Intelligent selection of optimal execution environment (Node.js/Docker)
2. **Server Bootstrap**: MCP server initialization with console output silencing for protocol safety
3. **Adapter Registration**: Dynamic discovery and loading of language-specific debug adapters
4. **Protocol Handshake**: MCP capability negotiation and tool registration with AI agents

### Debugging Workflow Integration
1. **Session Creation**: AI agent creates debug session specifying target language and application
2. **Adapter Selection**: System selects appropriate language adapter (Python/debugpy, JS/js-debug, etc.)
3. **Debug Tool Spawn**: Native debugging tool launched with DAP communication channel
4. **Proxy Management**: Bidirectional protocol translation between MCP and DAP
5. **Interactive Debugging**: AI agent issues debugging commands through standardized MCP tools
6. **State Management**: Session lifecycle and debugging state maintained across operations

## Key Design Principles and Patterns

### Production-Ready Architecture
- **Comprehensive Error Handling**: Typed error system with graceful degradation and actionable error messages
- **Cross-Platform Compatibility**: Consistent behavior across Windows, macOS, and Linux environments
- **Resource Management**: Proper cleanup of debug processes, network connections, and temporary resources
- **Security Considerations**: Console output protection, process isolation, and safe command execution

### Developer Experience Excellence
- **Zero-Configuration Setup**: Batteries-included distribution requiring no additional toolchain setup
- **Intelligent Defaults**: Automatic runtime detection with manual override capabilities
- **Rich Documentation**: Comprehensive examples, visualizations, and educational resources
- **Extensible Design**: Plugin architecture enabling additional language support and custom adapters

### Quality and Reliability Standards
- **Extensive Testing**: 95+ test scenarios covering all tool/language combinations with cross-platform validation
- **Performance Optimization**: Efficient resource usage with caching, lazy loading, and connection pooling
- **Protocol Compliance**: Strict adherence to MCP and DAP specifications with comprehensive validation
- **Continuous Integration**: Automated testing across multiple platforms with Docker-based validation environments

This root directory represents a complete, production-ready debugging ecosystem that democratizes sophisticated debugging capabilities for AI agents across multiple programming languages while maintaining enterprise-grade reliability, security, and performance standards.
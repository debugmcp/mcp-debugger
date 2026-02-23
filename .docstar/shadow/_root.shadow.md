# (root)/
@children-hash: 847258854dffbf6f
@generated: 2026-02-23T19:01:35Z

## Overall Purpose and Responsibility

The MCP Debugger project is a comprehensive multi-language debugging framework that extends the Model Context Protocol (MCP) to enable step-through debugging capabilities for AI agents and LLMs. This monorepo provides a complete debugging ecosystem supporting Python, JavaScript/TypeScript, Go, and Rust through a unified protocol-compliant MCP server, intelligent runtime launchers, and extensive development tooling.

## Key Components and System Architecture

### Core Debugging Infrastructure
The **`src/`** directory contains the primary MCP server implementation that:
- Exposes 18 MCP tools for session management, breakpoints, stepping, and variable inspection
- Implements a pluggable Debug Adapter Protocol (DAP) proxy system for multi-language support
- Provides console output silencing to maintain MCP protocol compliance
- Supports both stdio and Server-Sent Events (SSE) transport mechanisms

### Multi-Language Debug Adapters (`packages/`)
A complete ecosystem of language-specific debugging solutions:
- **adapter-javascript**: TypeScript/JavaScript debugging via vscode-js-debug
- **adapter-python**: Python debugging through debugpy integration
- **adapter-go**: Go debugging leveraging native Delve DAP support  
- **adapter-rust**: Rust debugging via CodeLLDB orchestration
- **shared**: Common interfaces, factory patterns, and architectural foundations

All adapters implement consistent `IDebugAdapter` contracts while handling language-specific toolchain discovery, environment validation, and debugging capabilities.

### Intelligent Runtime Management
- **`mcp_debugger_launcher/`**: Python package providing automatic runtime detection (Node.js vs Docker) and server lifecycle management
- **`docker/`**: Containerization infrastructure with development-focused debugging capabilities
- **`scripts/`**: Comprehensive automation for builds, testing, deployment, and cross-platform setup

### Comprehensive Validation (`tests/`)
Five-tier testing architecture ensuring reliability across all components:
- Unit testing with extensive mocking and dependency injection
- Integration testing with production dependencies
- End-to-end validation across transport mechanisms
- Stress testing for performance and reliability characteristics
- Language-specific adapter validation across debugging scenarios

### Development and Documentation (`examples/`)
Educational resources and validation infrastructure:
- Multi-language debugging examples with intentional bugs for learning
- Autonomous agent demonstrations showing complete debugging workflows
- Terminal UI visualization tools for debugging session monitoring
- Automated recording infrastructure for documentation generation

## Public API Surface and Entry Points

### Primary Distribution Formats
- **NPM Package**: `@modelcontextprotocol/debugger` providing CLI access and programmatic integration
- **Python Launcher**: `mcp-debugger-launcher` with intelligent runtime detection and deployment
- **Docker Image**: `debugmcp/mcp-debugger:latest` for containerized environments
- **Platform Binaries**: Executable bundles for direct deployment

### MCP Protocol Interface
**18 Core Debugging Tools** exposed through MCP protocol:
- **Session Management**: `create_debug_session`, `close_debug_session`
- **Execution Control**: `start_debugging`, `continue`, `step_over`, `step_into`, `step_out`
- **Breakpoint Operations**: `set_breakpoint`, `remove_breakpoint`, `list_breakpoints`
- **Data Inspection**: `get_variables`, `get_stack_trace`, `evaluate_expression`
- **State Management**: `pause`, `get_debug_info`, `get_available_sessions`

### Development Integration Points
- **CLI Commands**: `stdio` (default), `sse`, and diagnostic commands
- **Language Support**: Automatic detection and configuration for Python, JavaScript/TypeScript, Go, and Rust
- **Transport Flexibility**: Both stdio and HTTP-based SSE modes for different integration patterns
- **Container Deployment**: Complete Docker integration with development volume mounting

## Internal Organization and Data Flow

### Debugging Session Lifecycle
1. **Runtime Detection**: Intelligent selection of optimal execution environment (Node.js/Docker)
2. **Session Creation**: Client requests debug session via MCP tools
3. **Language Discovery**: Adapter registry resolves appropriate debug adapter
4. **Proxy Orchestration**: DAP proxy process spawned for isolated debugging environment
5. **Debug Target Launch**: Language-specific debugger attached to target application
6. **Interactive Debugging**: Step-through operations, variable inspection, and execution control
7. **Session Cleanup**: Graceful resource deallocation and process termination

### Multi-Language Architecture
The system employs a **policy-driven adapter architecture** that:
- Abstracts language-specific debugging backends through unified interfaces
- Supports complex debugging scenarios (async operations, goroutines, multi-threading)
- Handles toolchain discovery and environment validation automatically
- Provides extensible framework for additional language support

### Protocol Compliance Strategy
- **Console Output Silencing**: Prevents debugging output from corrupting MCP protocol
- **Structured Error Handling**: All errors flow through MCP protocol rather than stderr
- **Transport Abstraction**: Consistent behavior across stdio and HTTP transports
- **State Management**: Comprehensive session state tracking and recovery

## Important Patterns and Conventions

### Development-First Design Philosophy
- **Hot Reload Support**: Docker volume mounting and development-optimized containers
- **Rich Developer Experience**: Terminal UI visualizations, extensive logging, and diagnostic tools
- **Educational Focus**: Comprehensive examples, intentional bugs for learning, and documentation automation

### Production-Ready Deployment
- **Cross-Platform Compatibility**: Windows, macOS, Linux with platform-specific optimizations
- **Dependency Vendoring**: Self-contained packages eliminating runtime requirements
- **Graceful Degradation**: Missing components generate warnings rather than failures
- **Resource Management**: Robust process lifecycle with cleanup and orphan detection

### Quality and Reliability
- **Comprehensive Testing**: Multi-tier testing strategy from unit to stress testing
- **Protocol Compliance**: Strict adherence to MCP and DAP specifications
- **Error Recovery**: Sophisticated error handling with recovery mechanisms
- **Performance Optimization**: Caching, lazy evaluation, and efficient resource utilization

The MCP Debugger represents a complete, production-ready debugging ecosystem that bridges the gap between AI agents and traditional development tools, enabling sophisticated debugging workflows through the standardized Model Context Protocol while maintaining compatibility with existing development environments and toolchains.
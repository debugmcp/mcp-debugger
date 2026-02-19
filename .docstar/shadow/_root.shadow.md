# (root)/
@children-hash: 4798d49539f1c7ee
@generated: 2026-02-19T23:49:47Z

## Overall Purpose and Responsibility

The root directory contains the complete **MCP (Model Context Protocol) Debugger** - a comprehensive debugging framework that enables AI agents to perform sophisticated debugging operations across multiple programming languages through standardized MCP protocol tools. This system bridges the gap between AI agents and language-specific debug adapters, providing unified debugging capabilities for JavaScript/TypeScript, Python, Rust, and Go environments.

## Key Components and System Architecture

### Core Framework (`src/`)
The heart of the system is a complete MCP server implementation that exposes 16 debugging tools through the Model Context Protocol. This includes session management, execution control (step over/into/out, continue, pause), variable inspection, stack trace analysis, and expression evaluation. The server uses a pluggable architecture with dynamic debug adapter discovery and sophisticated DAP (Debug Adapter Protocol) proxy management for multi-language support.

### Language Adapter Ecosystem (`packages/`)
A modular plugin system providing specialized debugging adapters for each supported language:
- **JavaScript/TypeScript**: VS Code js-debug integration with intelligent project detection
- **Python**: debugpy integration with virtual environment support
- **Go**: Delve DAP integration with goroutine management
- **Rust**: CodeLLDB integration with Cargo workspace handling
- **Shared Foundation**: Common interfaces and abstractions enabling consistent behavior

All adapters implement standardized interfaces while adapting to language-specific debugging capabilities and toolchains.

### Distribution and Deployment
- **MCP Debugger CLI** (`packages/mcp-debugger/`): Batteries-included distribution bundling all adapters into a single deployable tool
- **Python Launcher** (`mcp_debugger_launcher/`): Intelligent runtime detection and management tool for optimal deployment across Node.js/npm and Docker environments
- **Docker Infrastructure** (`docker/`): Containerized development environment with integrated debugging capabilities
- **Build Automation** (`scripts/`): Comprehensive build, test, packaging, and deployment orchestration

### Quality Assurance (`tests/`)
Multi-layered testing infrastructure providing unit, integration, and end-to-end validation across all languages, transport mechanisms (stdio/SSE), and deployment scenarios. Includes stress testing, cross-platform compatibility validation, and comprehensive mock infrastructure.

### Educational and Validation Resources (`examples/`)
Complete demonstration suite showcasing debugging workflows across all supported languages, from simple variable inspection to complex concurrent programming scenarios. Includes autonomous agent demonstrations, visual debugging tools, and educational progressions.

## Public API Surface and Entry Points

### Primary User Interfaces
- **CLI Command**: `npx @debugmcp/mcp-debugger` - Main debugging interface supporting stdio and SSE transport modes
- **Python Launcher**: `mcp_debugger_launcher` package for intelligent runtime selection and server lifecycle management
- **Docker Container**: `debugmcp/mcp-debugger:latest` for containerized deployment with debugging capabilities

### MCP Protocol Tools (16 Core Tools)
- **Session Management**: `create_debug_session`, `list_debug_sessions`, `close_debug_session`
- **Execution Control**: `start_debugging`, `step_over`, `step_into`, `step_out`, `continue_execution`, `pause_execution`
- **Code Inspection**: `get_variables`, `get_local_variables`, `get_stack_trace`, `get_scopes`, `get_source_context`
- **Dynamic Evaluation**: `evaluate_expression`
- **Language Discovery**: `list_supported_languages`

### Transport Mechanisms
- **STDIO Mode**: JSON-RPC over stdin/stdout for direct MCP client integration
- **SSE Mode**: HTTP Server-Sent Events for web-based integration and browser clients
- **Configuration**: Extensive logging controls, environment detection, and adapter-specific settings

## Internal Organization and Data Flow

### AI Agent → MCP Server → Debug Adapter Flow
1. **Protocol Layer**: AI agents communicate via MCP JSON-RPC protocol over stdio or SSE transport
2. **Server Layer**: MCP server translates tool requests into debug operations, managing sessions and state
3. **Proxy Layer**: DAP proxy system bridges MCP and Debug Adapter Protocol, handling language-specific behaviors
4. **Adapter Layer**: Language-specific adapters interface with actual debugging tools (debugpy, js-debug, Delve, CodeLLDB)
5. **Runtime Layer**: Target programs execute under debugger control with breakpoints, variable inspection, and step execution

### Development to Production Pipeline
- **Development**: Multi-language examples and comprehensive testing infrastructure enable rapid development
- **Build**: Sophisticated bundling creates self-contained distributions with vendored dependencies
- **Package**: Multiple distribution channels (npm, Python pip, Docker) with intelligent runtime detection
- **Deploy**: Automated launcher selection ensures optimal execution environment across development and production

## Critical Design Principles

### Language-Agnostic Debugging
Unified MCP protocol interface abstracts away language-specific debugging complexities while preserving full debugging capabilities through adapter-specific implementations and policy-driven session management.

### AI Agent Optimization
- Console output silencing maintains MCP protocol integrity
- Structured tool responses enable predictable AI agent integration
- Comprehensive error handling with actionable error messages
- Stateful session management supporting complex debugging workflows

### Production Readiness
- Graceful degradation when language tools are missing
- Cross-platform compatibility (Windows, Linux, macOS)
- Container-aware path resolution and workspace handling
- Robust process lifecycle management with proper cleanup

### Developer Experience
- Batteries-included distribution eliminates dependency management complexity
- Progressive examples from simple breakpoints to advanced concurrent debugging
- Rich diagnostic capabilities and environment validation
- Comprehensive documentation through working code examples

This framework represents a complete solution for AI-driven debugging, enabling autonomous agents to perform sophisticated debugging operations across polyglot codebases while maintaining the flexibility to adapt to diverse development environments and deployment scenarios.
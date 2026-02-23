# (root)/
@children-hash: 7c3df5c8f7860401
@generated: 2026-02-23T15:28:03Z

## Overall Purpose and Responsibility

The root directory represents **Debug MCP** - a comprehensive multi-language step-through debugging framework built on the Model Context Protocol (MCP). This project enables Large Language Models to perform interactive debugging across Python, JavaScript/TypeScript, Rust, and Go applications through a standardized protocol interface. The system bridges the gap between AI agents and traditional debugging tools by providing MCP-compliant access to Debug Adapter Protocol (DAP) implementations.

## Key Components and System Architecture

### Core Debugging Infrastructure
- **src/**: Complete MCP server implementation providing 18 debugging tools through unified API, supporting both stdio and Server-Sent Events transports with comprehensive session management
- **packages/**: Monorepo of language-specific debug adapters (JavaScript, Python, Go, Rust, Mock) plus shared foundation library and batteries-included CLI distribution
- **examples/**: Extensive multi-language testing and demonstration suite with educational debugging scenarios, autonomous agent workflows, and visual documentation generation

### Development and Operations Support  
- **scripts/**: Complete automation ecosystem for build pipelines, CI/CD workflows, cross-platform setup, Docker integration, and dependency management
- **tests/**: Five-tier testing architecture covering unit, integration, E2E, stress, and manual validation across all supported languages and transport mechanisms
- **docker/**: Containerization infrastructure for development workflows with integrated debugging server and volume mount support

### Language Ecosystem Support
- **mcp_debugger_launcher/**: Intelligent Python launcher package providing runtime detection and lifecycle management for optimal deployment across Node.js and Docker environments
- Configuration files supporting modern toolchain (ESLint flat config, Vitest monorepo setup, TypeScript compilation)

### Documentation and Validation Tools
- Coverage analysis utilities for actionable testing insights
- Cross-platform shell wrappers for Claude Code IDE integration
- Visual demonstration and recording infrastructure for user documentation

## Public API Surface and Integration Points

### Primary Entry Points
- **MCP Server**: `npx @debugmcp/mcp-debugger` - Main CLI providing 18 MCP tools for complete debugging workflows
- **Python Launcher**: `mcp-debugger-launcher` package for intelligent runtime selection and process management
- **Docker Container**: `debugmcp/mcp-debugger:latest` for containerized debugging environments
- **Shell Wrapper**: `mcp-debugger-wrapper.sh` for Claude Code IDE integration with automatic transport detection

### Core Debugging API (18 MCP Tools)
- **Session Management**: `createSession`, `listSessions`, `destroySession` for multi-language debugging coordination
- **Execution Control**: `startDebugging`, `continue`, `stepOver/Into/Out`, `pause`, `stop` for program flow management
- **Data Inspection**: `getVariables`, `getStackTrace`, `evaluateExpression` for runtime state analysis
- **Breakpoint Management**: `setBreakpoint`, `getBreakpoints`, `removeBreakpoint` for execution control points
- **Process Operations**: `attachToProcess`, `detachFromProcess` for runtime debugging scenarios
- **Language Support**: `getAvailableLanguages`, `getSupportedExecutables` for environment discovery

### Multi-Language Support Matrix
- **Python**: debugpy integration with virtual environment handling, Django/Flask support
- **JavaScript/TypeScript**: vscode-js-debug with ESM/CommonJS, TypeScript runners, source maps
- **Go**: Native Delve DAP support for applications, tests, core dumps, and goroutine debugging
- **Rust**: CodeLLDB integration with Cargo workspace analysis and cross-platform binary support
- **Extensible**: Plugin architecture supporting additional language adapters

### Transport Mechanisms
- **STDIO Mode**: Default MCP protocol over stdin/stdout for command-line integration
- **SSE Mode**: HTTP-based Server-Sent Events for web clients (default port 3001)
- **Docker Mode**: Containerized deployment with volume mounting for development workflows

## System Integration and Data Flow

### Multi-Layer Architecture
The system implements a sophisticated **four-layer architecture**:

1. **Protocol Layer**: MCP-compliant server handling JSON-RPC 2.0 communication and tool orchestration
2. **Session Layer**: Multi-language debugging session management with lifecycle coordination and state persistence
3. **Adapter Layer**: Language-specific debugging backends implementing unified interfaces while preserving native capabilities
4. **Process Layer**: Debug Adapter Protocol integration with actual language debuggers (debugpy, vscode-js-debug, Delve, CodeLLDB)

### Workflow Integration Patterns
- **Agent-Driven Debugging**: LLMs interact through standardized MCP tools for autonomous debugging workflows
- **IDE Integration**: Direct integration with Claude Code and other MCP-compatible development environments
- **CI/CD Integration**: Automated debugging capabilities for testing pipelines and deployment validation
- **Educational Use**: Comprehensive examples and documentation for learning debugging techniques

### Quality Assurance and Reliability
- **Comprehensive Testing**: 1000+ tests across unit, integration, E2E, and stress testing scenarios
- **Cross-Platform Support**: Native Windows, macOS, Linux compatibility with platform-specific optimizations
- **Protocol Safety**: Rigorous stdout protection ensuring MCP compliance in all execution modes
- **Graceful Degradation**: Intelligent fallback mechanisms for missing dependencies or environment constraints

## Key Design Principles

### Developer Experience Focus
- **Zero Configuration**: Automatic toolchain detection and intelligent runtime selection
- **Batteries Included**: Complete language support bundled in single distribution
- **Visual Documentation**: Rich terminal UI, automated recording, and demonstration infrastructure
- **Educational Structure**: Progressive complexity examples from basic debugging to advanced concurrent programming

### Protocol-First Design
- **MCP Compliance**: Full adherence to Model Context Protocol specifications with JSON-RPC 2.0
- **Transport Flexibility**: Multiple communication mechanisms supporting diverse integration scenarios  
- **Extensibility**: Plugin architecture enabling additional language support and custom debugging capabilities
- **AI-Optimized**: Designed specifically for LLM consumption with structured APIs and predictable behavior patterns

This root directory delivers a complete, production-ready debugging ecosystem that transforms traditional step-through debugging into an AI-accessible capability, enabling sophisticated debugging workflows through standardized protocol interfaces while maintaining the full power and flexibility of native debugging tools.
# (root)/
@children-hash: baf3aa3b4a0d7a9c
@generated: 2026-02-16T08:26:13Z

## Overall Purpose and Responsibility

This is the **Debug MCP Server** - a comprehensive Model Context Protocol (MCP) server that enables AI agents to perform step-through debugging across multiple programming languages (JavaScript/TypeScript, Python, Go, and Rust). The project provides a unified debugging interface that translates MCP tool calls into Debug Adapter Protocol (DAP) commands, allowing AI assistants to set breakpoints, inspect variables, step through code, and evaluate expressions in a language-agnostic manner.

## Key Components and System Architecture

### Core Infrastructure
- **`src/`** - Primary MCP server implementation with dependency injection architecture, debug session management, and DAP proxy system that orchestrates debugging across multiple languages
- **`packages/`** - Modular adapter ecosystem providing language-specific debugging integrations (JavaScript/TypeScript via VS Code js-debug, Python via debugpy, Go via Delve, Rust via CodeLLDB) with shared contracts and CLI distribution
- **`mcp_debugger_launcher/`** - Intelligent Python-based launcher that automatically detects and manages optimal runtime environments (Node.js/Docker) for cross-platform deployment

### Development and Testing Infrastructure  
- **`tests/`** - Comprehensive multi-layer test suite (unit/integration/e2e/stress) validating debugging workflows across all supported languages with real debuggers and production scenarios
- **`examples/`** - Educational demonstration suite and validation framework with multi-language debugging scenarios, autonomous agent demos, and rich terminal visualization tools
- **`scripts/`** - Build automation, cross-platform development tooling, and deployment orchestration including Docker containerization and marketplace packaging

### Deployment and Integration
- **`docker/`** - Containerization infrastructure for development workflows with integrated debugging capabilities and volume mounting for hot-reload scenarios  
- **Configuration Files** - Modern tooling setup (ESLint flat config, Vitest with sophisticated console filtering, TypeScript/ESM resolution) optimized for monorepo debugging workflows
- **Coverage Analysis Tools** - Detailed impact analysis for testing prioritization with actionable insights for coverage improvement

## Public API Surface and Entry Points

### Primary Integration Points
- **MCP Protocol Interface**: 19 standardized debugging tools exposed through MCP protocol enabling AI agents to perform complete debugging workflows
- **CLI Command**: `npx @debugmcp/mcp-debugger` - Main entry point supporting stdio and SSE transport modes with automatic language detection
- **Python Launcher**: `mcp-debugger-launcher` command providing intelligent runtime detection and deployment across Node.js and Docker environments
- **Language Support Matrix**: Comprehensive debugging for JavaScript/TypeScript, Python, Go, and Rust with framework-specific optimizations

### Key API Categories
- **Session Management**: Debug session creation, lifecycle management, and multi-session coordination with automatic resource cleanup
- **Debug Operations**: Breakpoint management, code stepping, variable inspection, expression evaluation, and stack trace analysis
- **Transport Mechanisms**: STDIO mode for direct AI agent integration and SSE mode for web-based debugging interfaces
- **Adapter System**: Dynamic language detection with pluggable architecture supporting custom debugger integrations

## Internal Organization and Data Flow

### Request Processing Flow
1. **MCP Client Request**: AI agent calls debugging tool via MCP protocol
2. **Server Validation**: Debug MCP Server validates session state and tool parameters  
3. **Language Detection**: Adapter registry identifies appropriate debugger based on file types and project structure
4. **DAP Translation**: Session manager translates MCP commands into Debug Adapter Protocol messages
5. **Proxy Orchestration**: DAP proxy manages communication with language-specific debugger processes
6. **Response Aggregation**: Results formatted and returned via MCP protocol to AI agent

### Cross-Language Architecture
- **Unified Contracts**: Shared TypeScript interfaces ensure consistent behavior across all language adapters
- **Factory Pattern**: Language-specific factories handle environment detection, tool validation, and debugger instantiation
- **Policy-Based Design**: Adapter-specific behaviors encapsulated behind common debugging abstractions
- **Graceful Degradation**: Missing language tools generate warnings rather than failures, enabling partial functionality

## Important Patterns and System Design

### Production-Ready Architecture
- **Dependency Injection**: Complete constructor injection enabling comprehensive testing and environment customization
- **Process Isolation**: Robust subprocess management with timeout protection, graceful shutdown, and resource cleanup
- **Protocol Safety**: Explicit console output silencing prevents MCP protocol corruption while maintaining structured logging
- **Error Resilience**: Comprehensive timeout protection, typed error hierarchy, and structured error reporting

### Developer Experience Focus
- **Batteries-Included Distribution**: Single CLI tool bundles all language adapters eliminating complex dependency management
- **Intelligent Environment Detection**: Automatic discovery of language toolchains with caching and platform-aware fallbacks
- **Rich Development Tools**: Terminal visualization, automated recording infrastructure, and comprehensive debugging examples
- **Cross-Platform Compatibility**: Consistent operation across Windows, macOS, and Linux with containerized deployment options

### Quality Assurance Strategy
- **Multi-Layer Testing**: Unit, integration, end-to-end, and stress testing with real debuggers and production scenarios
- **Coverage Standards**: High coverage thresholds (90%+) with detailed impact analysis and actionable improvement insights  
- **Protocol Compliance**: Systematic validation of MCP tool matrix (19 tools × 4+ languages) ensuring reliable AI agent integration
- **Resource Safety**: Comprehensive cleanup patterns, port allocation management, and process lifecycle validation

This project serves as a complete debugging infrastructure that bridges AI agents with professional debugging capabilities across multiple programming languages, providing both educational resources for learning debugging techniques and production-ready tooling for AI-assisted development workflows.
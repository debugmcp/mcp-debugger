# (root)/
@children-hash: 7c3378e5bb5a85c6
@generated: 2026-02-24T18:28:21Z

## Overall Purpose and Responsibility

This is the root directory of `mcp-debugger`, a comprehensive runtime debugging platform that enables AI agents and developers to perform step-through debugging across multiple programming languages (Python, JavaScript/TypeScript, Go, Rust) through a unified Model Context Protocol (MCP) interface. The system bridges the gap between AI agents and traditional debugging workflows by providing standardized debugging capabilities while maintaining cross-platform compatibility and container deployment support.

## Architecture and Component Integration

The project follows a sophisticated monorepo architecture with clear separation of concerns:

### Core Framework (`packages/`)
- **`shared/`**: Foundation package providing type-safe contracts, interfaces, and utilities for consistent debugging behavior
- **Language-specific adapters**: `adapter-javascript`, `adapter-python`, `adapter-go`, `adapter-rust` implementing Debug Adapter Protocol (DAP) integration for each language
- **`adapter-mock/`**: Complete DAP-compliant testing infrastructure
- **`mcp-debugger/`**: Batteries-included CLI distribution bundling all adapters

### Main Implementation (`src/`)
Multi-layered debug server architecture:
- **Protocol Layer**: MCP server with stdio/SSE transport modes
- **Session Management**: Complete debug session orchestration with dual state models
- **Proxy System**: Multi-process DAP proxy for language-agnostic debugging
- **Dependency Injection**: Comprehensive DI framework enabling testability and modularity

### Supporting Infrastructure
- **`tests/`**: Comprehensive testing suite (unit, integration, e2e, stress) across all supported languages
- **`scripts/`**: Development automation, CI/CD pipeline support, cross-platform setup utilities
- **`examples/`**: Educational demonstrations, integration tests, and visualization tools
- **`docs/`**: Official Debug Adapter Protocol JSON Schema specification
- **`docker/`**: Container deployment with integrated debugging capabilities

## Public API Surface and Entry Points

### Primary Interfaces
- **CLI Tool**: `mcp-debugger` binary providing unified debugging across all supported languages
- **MCP Server Factory**: `createDebugMcpServer()` for programmatic server creation
- **Python Launcher**: `debug-mcp-server` command via `mcp_debugger_launcher` package
- **Docker Container**: Production-ready containerized deployment

### MCP Tools (18 total)
Complete debugging API including:
- **Session Management**: create_debug_session, list_debug_sessions, close_debug_session
- **Debug Control**: start_debugging, attach_to_process, detach_from_process
- **Execution Control**: step_over, step_into, step_out, continue_execution, pause_execution
- **Data Inspection**: get_variables, get_local_variables, get_stack_trace, get_scopes
- **Advanced Features**: evaluate_expression, get_source_context, set_breakpoint, list_supported_languages

### Transport Modes
- **Stdio Mode**: Standard MCP transport for direct AI agent integration
- **SSE Mode**: HTTP-based Server-Sent Events for web applications
- **Container Support**: Full Docker deployment with volume mounting and debugging capabilities

## Key Integration Patterns

### Language Adapter Architecture
Each language adapter implements shared interfaces while handling language-specific complexities:
- **Environment Detection**: Automatic toolchain discovery and validation
- **Project Analysis**: Intelligent configuration of language-specific debugging parameters
- **Protocol Bridging**: DAP message handling between debug clients and language-specific debug engines

### Multi-Process Debugging
The system employs a sophisticated proxy architecture:
1. MCP requests route through the main server to session managers
2. Session managers spawn isolated worker processes for language-specific debugging
3. DAP communication flows through policy-driven adapter selection
4. Results propagate back through the MCP protocol layer

### Development and Deployment Workflow
- **Monorepo Management**: PNPM workspace with shared dependencies and cross-package linking
- **Build Pipeline**: TypeScript compilation, adapter vendoring, and container building
- **Quality Assurance**: Comprehensive testing across languages, transports, and deployment scenarios
- **CI/CD Integration**: GitHub Actions with local testing capabilities and automated validation

## Important Design Principles

### AI Agent Optimization
- **Console Output Silencing**: Protects MCP protocol integrity from debug output interference
- **Standardized Interface**: Uniform debugging capabilities regardless of target language
- **Error Resilience**: Comprehensive error handling with graceful degradation

### Cross-Platform Compatibility
- **Universal Toolchain Support**: Works with existing development environments
- **Container-First Design**: Optimized for containerized AI agent deployments
- **Path Resolution**: Intelligent handling of different filesystem layouts and workspace structures

### Production Readiness
- **Resource Management**: Proper cleanup, timeout handling, and orphan process detection
- **Security**: Sanitization of sensitive data in logs and protocol messages  
- **Performance**: Optimized for real-time debugging with minimal latency overhead
- **Scalability**: Support for multiple concurrent debugging sessions across languages

This project represents a complete debugging ecosystem that abstracts language-specific complexity while providing robust, standardized debugging capabilities through the Model Context Protocol, enabling seamless integration between AI agents and traditional software development workflows.
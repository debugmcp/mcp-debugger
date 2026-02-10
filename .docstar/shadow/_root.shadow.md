# (root)/
@generated: 2026-02-10T21:29:02Z

## Overall Purpose and Responsibility

The root directory represents the complete MCP (Model Context Protocol) Debugger project - a comprehensive multi-language debugging platform that enables AI agents to debug code across Python, JavaScript/TypeScript, Go, Rust, and Java through a unified protocol interface. This system bridges the gap between AI agents and traditional debugging tools, providing step-through debugging capabilities while handling the complexity of language-specific debug adapters, process management, and protocol translation.

## Key Components and System Integration

### Core Architecture
The project follows a sophisticated layered architecture with multiple interconnected subsystems:

**Primary Implementation (`src/`)**
- Complete MCP server implementation exposing 20+ debugging tools to AI agents
- Multi-language debug adapter system with dynamic discovery and lifecycle management
- Debug Adapter Protocol (DAP) proxy bridging MCP clients to native language debuggers
- Production-ready CLI with stdio/SSE transport modes and container awareness

**Language Adapter Ecosystem (`packages/`)**
- Six production-ready debug adapters (JavaScript, Python, Java, Go, Rust, plus mock) 
- Shared foundational library providing unified interfaces and factory patterns
- NPM-distributable CLI bundle integrating all language support
- Cross-platform toolchain validation and environment management

**Comprehensive Testing Infrastructure (`tests/`)**
- Multi-layered test suite from unit tests through end-to-end workflow validation
- Language-specific adapter testing with real toolchain integration
- Stress testing for transport reliability and performance validation
- Complete mock frameworks and test utilities for development workflows

**Operational Automation (`scripts/`)**
- Build and bundling pipeline with Docker containerization
- Testing and validation infrastructure with CI/CD integration
- Development environment management and platform-specific setup
- Quality assurance tools including bundle optimization and memory monitoring

**Educational and Demonstration Resources (`examples/`)**
- Complete debugging workflow demonstrations across all supported languages
- Interactive terminal visualizations and professional documentation generation
- Educational tutorials and autonomous agent debugging demonstrations
- Cross-language validation scenarios and testing frameworks

**Distribution Infrastructure**
- Docker containerization with multi-service debugging support (`docker/`)
- Cross-platform launcher with intelligent runtime detection (`mcp_debugger_launcher/`)
- NPM package distribution with executable bundling
- Container-aware deployment with volume mounting and remote debugging

### Component Integration Flow

The system integrates through a carefully orchestrated data flow:

1. **Entry Points**: CLI interface (`src/index.ts`) or launcher (`mcp_debugger_launcher/`) establishes MCP transport
2. **Protocol Layer**: MCP server (`src/server.ts`) exposes debugging tools to AI agents via JSON-RPC 2.0
3. **Session Management**: High-level debugging operations coordinate multi-language debugging sessions
4. **Adapter Discovery**: Dynamic loading of language-specific debug adapters from packages ecosystem
5. **Protocol Translation**: DAP proxy system bridges MCP commands to native debugger protocols
6. **Native Integration**: Language adapters coordinate with actual debugging tools (debugpy, js-debug, Delve, etc.)

## Public API Surface and Entry Points

### Primary Distribution Methods

**NPM Package Distribution**
- `@modelcontextprotocol/debugger` - Main npm package with all language adapters bundled
- `npx @modelcontextprotocol/debugger` - Direct CLI execution with automatic dependency resolution
- Container-friendly with stdio transport and console output silencing

**Docker Distribution**
- `debugmcp/mcp-debugger:latest` - Complete containerized debugging environment
- Multi-service architecture supporting both MCP server and remote debugging capabilities
- Volume mount support for host filesystem integration

**Cross-Platform Launcher**
- `mcp_debugger_launcher` Python package - Intelligent runtime detection and deployment
- Automatic fallback between npm/npx and Docker based on environment availability
- CLI modes: `--stdio` (default), `--sse [PORT]`, `--docker`, `--npm`

### Core MCP Debugging Tools

The system exposes a comprehensive debugging API through MCP protocol:

**Session Management**
- `createDebugSession` - Initialize debugging for specific programming languages
- `closeDebugSession` - Cleanup and terminate debugging sessions
- Multi-session support with proper resource isolation

**Execution Control**
- `startDebugging` - Launch debugging with configurable launch parameters
- `continueExecution`, `stepOver`, `stepInto`, `stepOut` - Fine-grained execution control
- `attachToProcess`, `detachFromProcess` - Runtime attachment capabilities

**Breakpoint Management**
- `setBreakpoint`, `removeBreakpoint` - Strategic debugging pause points
- Cross-platform line-based and function-based breakpoint support
- Conditional breakpoint support where language debuggers provide capability

**Data Inspection and Analysis**
- `getVariables`, `getLocalVariables` - Runtime state inspection
- `getStackTrace` - Call stack analysis and navigation
- `evaluateExpression` - Runtime expression evaluation in debugging context

### Supported Programming Languages

**Production-Ready Language Support**
- **JavaScript/TypeScript**: Via VS Code's js-debug with Node.js, tsx, ts-node runtime detection
- **Python**: Through debugpy integration with cross-platform executable discovery
- **Java**: Command-line jdb integration with protocol translation and process management  
- **Go**: Native Delve DAP support with comprehensive toolchain validation
- **Rust**: CodeLLDB integration with Cargo project management and binary analysis

**Development and Testing Support**
- **Mock Adapter**: Configurable debugging simulation for testing and development workflows
- Comprehensive validation scenarios across all language implementations
- Cross-platform compatibility testing with real toolchain integration

## Integration Patterns and Usage Scenarios

### AI Agent Integration
The system is specifically designed for AI agent consumption with:
- Clean JSON-RPC 2.0 protocol compliance eliminating parsing complexity
- Structured error responses with actionable guidance for debugging workflow recovery
- Comprehensive logging with sanitization for security in AI training contexts
- Protocol-compliant transport options (stdio for containers, SSE for web integration)

### Development Workflow Integration
- **IDE Support**: Can integrate with any MCP-compatible development environment
- **CI/CD Integration**: Container-first design with proper exit codes and error handling
- **Cross-Platform Development**: Windows, Linux, and macOS support with platform-specific optimizations
- **Educational Use**: Complete example workflows and interactive demonstrations for learning debugging concepts

### Container and Cloud Deployment
- **Docker-Native**: Full containerization support with volume mounting and networking
- **Process Management**: Sophisticated proxy lifecycle management with orphan detection
- **Resource Cleanup**: Automatic cleanup with configurable timeouts and resource limits
- **Security Considerations**: Path sanitization and proper privilege handling across environments

The MCP Debugger represents a complete ecosystem that transforms traditional debugging from a manual, IDE-specific activity into a programmable, AI-accessible capability while preserving the full power and language-specific features of native debugging tools.
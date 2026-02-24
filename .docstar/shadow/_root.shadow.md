# (root)/
@children-hash: 13767909796f4731
@generated: 2026-02-24T21:16:28Z

## Overall Purpose and Responsibility

The root directory contains a comprehensive multi-language debugging platform implementing the Model Context Protocol (MCP) for LLM agent debugging workflows. This system provides a unified debugging interface supporting JavaScript/TypeScript, Python, Go, and Rust through the Debug Adapter Protocol (DAP), enabling step-through debugging, breakpoint management, and variable inspection across diverse development environments.

## Key Components and Architecture

### Core Infrastructure
- **MCP Debug Server** (`src/`): Complete server implementation with 18 MCP tools, session management, and multi-language adapter system supporting both stdio and HTTP-based SSE transport modes
- **Language Adapter Ecosystem** (`packages/`): Modular adapter framework with shared interfaces, language-specific implementations, and a unified CLI distribution
- **Containerization** (`docker/`): Docker infrastructure with development-optimized debugging support and remote debugging capabilities

### Development and Testing Infrastructure
- **Comprehensive Testing** (`tests/`): Multi-layered testing approach covering unit, integration, e2e, and stress testing across all supported languages and deployment scenarios
- **Example Scenarios** (`examples/`): Educational demonstrations, integration tests, and visualization tools including autonomous debugging agents and terminal UI components
- **Build and Deployment Automation** (`scripts/`): Complete CI/CD pipeline, Docker management, bundle optimization, and cross-platform development tools

### Language Support and Tooling
- **Python Integration** (`mcp_debugger_launcher/`): Intelligent runtime detection and process management for launching debug servers across Node.js/npx and Docker environments
- **Debug Adapter Protocol** (`docs/`): Official DAP JSON Schema specification providing protocol validation and implementation guidance
- **Configuration Management**: TypeScript monorepo setup with workspace management, ESLint configuration, and sophisticated build orchestration

## Public API Surface and Entry Points

### Primary Interfaces
- **CLI Command**: `mcp-debugger` (stdio mode default) and `debug-mcp-server` (Python launcher)
- **MCP Protocol**: 18 standardized debugging tools accessible via MCP clients including session management, breakpoints, stepping, and variable inspection
- **HTTP API**: SSE-based transport mode for web clients and browser integration
- **Container Deployment**: Docker images with integrated debugging capabilities

### Language-Specific Entry Points
- **JavaScript/TypeScript**: vscode-js-debug integration with project detection and TypeScript support
- **Python**: debugpy integration with virtual environment support and Django/Flask debugging
- **Go**: Delve DAP integration with goroutine management and build validation
- **Rust**: CodeLLDB integration with Cargo workspace support and cross-platform binary analysis

### Development Integration
- **IDE Support**: Debug Adapter Protocol compliance enabling VS Code and other DAP-compatible editor integration
- **CI/CD Integration**: Automated testing, bundle validation, and deployment pipelines
- **Container Orchestration**: Docker Compose configurations for development and testing environments

## Data Flow and System Integration

### Debug Session Lifecycle
1. **Environment Detection**: Runtime validation and toolchain discovery across supported languages
2. **Adapter Selection**: Dynamic adapter loading based on project type and language requirements
3. **Session Orchestration**: DAP proxy system managing multi-process debugging with proper lifecycle control
4. **Protocol Bridging**: MCP-to-DAP message translation enabling standardized debugging operations
5. **State Management**: Comprehensive session tracking with breakpoints, variable inspection, and execution control

### Cross-Component Communication
- **MCP Protocol**: JSON-RPC 2.0 communication between clients and debug server
- **DAP Integration**: Standardized debug adapter communication with language-specific backends
- **Process Management**: Multi-process architecture with robust IPC and cleanup mechanisms
- **Configuration Propagation**: Environment-aware settings management across components

## Important Patterns and Conventions

### Multi-Language Architecture
The system abstracts language-specific debugging complexity through a unified adapter interface while maintaining language-specific optimizations and toolchain integration. Each adapter handles environment validation, project detection, and debug server lifecycle management.

### Container-First Design
Docker integration is fundamental rather than auxiliary, with development-optimized containers supporting hot reload, remote debugging, and comprehensive logging infrastructure.

### Protocol Compliance
Strict adherence to both MCP and Debug Adapter Protocol specifications ensures interoperability with existing toolchains while providing standardized debugging capabilities for LLM agents.

### Testing and Quality Assurance
Comprehensive testing infrastructure validates protocol compliance, cross-platform compatibility, and performance characteristics through automated test suites covering all deployment scenarios and supported languages.

This platform represents a complete debugging ecosystem designed specifically for LLM agent development workflows, providing standardized debugging capabilities across multiple programming languages while maintaining the flexibility and performance characteristics required for production debugging scenarios.
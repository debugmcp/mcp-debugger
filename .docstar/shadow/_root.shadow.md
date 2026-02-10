# (root)/
@generated: 2026-02-09T18:21:58Z

## Overall Purpose and Responsibility

The root directory serves as the complete MCP (Model Context Protocol) Debugger project - a comprehensive, language-agnostic debugging platform that enables AI agents and development tools to perform sophisticated debugging operations across multiple programming languages (Python, JavaScript, TypeScript, Rust, Go, Java) through standardized protocol interfaces. This project bridges the gap between AI systems and traditional debugging workflows by providing MCP-compliant debugging tools that can be consumed by Claude and other AI agents while maintaining full compatibility with VS Code and other DAP-compatible development environments.

## Key Components and System Architecture

### Core Debugging Infrastructure
- **`src/`** - Complete MCP server implementation with Debug Adapter Protocol (DAP) proxy system, dynamic language adapter loading, and comprehensive session management
- **`packages/`** - Modular ecosystem of language-specific debug adapters (`adapter-*`) built on shared TypeScript contracts, distributed through unified `mcp-debugger` package
- **`mcp_debugger_launcher/`** - Python-based CLI tool providing unified deployment across Node.js/npm and Docker environments with intelligent runtime detection

### Development and Quality Assurance
- **`tests/`** - Multi-layer testing framework covering unit, integration, end-to-end, and stress testing with comprehensive validation across all supported languages
- **`scripts/`** - Complete development workflow automation including build pipeline, validation tools, deployment preparation, and debugging utilities
- **`examples/`** - Extensive demonstration ecosystem with test programs, MCP client implementations, and educational resources across all supported languages

### Supporting Infrastructure
- **`.husky/`** - Git hooks management with deprecation handling and developer migration guidance
- **`docker/`** - Containerization infrastructure supporting both production deployment and development debugging workflows
- **Configuration Files** - ESLint, Vitest, and other development tooling configurations enabling modern TypeScript/JavaScript development

### Operational Components
- **Coverage Analysis** (`analyze-coverage*.js`) - Post-test coverage analysis with prioritized insights for improving test coverage
- **Shell Integration** (`mcp-debugger-wrapper.sh`) - Bash wrapper ensuring proper stdio mode handling for Claude Code integration

## Public API Surface and Key Entry Points

### Primary Integration Points
- **`npx @debugmcp/mcp-debugger`** - Main CLI entry point providing MCP protocol-compliant debugging server with automatic language detection
- **`mcp-debugger-launcher`** - Python CLI tool for deployment across multiple runtime environments (Node.js, Docker)
- **MCP Protocol Interface** - 18+ standardized debugging tools including session management, breakpoint control, variable inspection, and execution management

### Development and Testing APIs
- **Factory Pattern Architecture** - Consistent adapter creation through `IAdapterFactory` implementations across all language adapters
- **Debug Session Management** - `SessionManager` providing complete debugging lifecycle with execution control and data retrieval
- **Container Integration** - Docker-based deployment with development debugging support and remote debugging capabilities

### Language-Specific Entry Points
Each language adapter provides standardized debugging capabilities:
- **Go**: Delve (dlv) integration with native DAP support
- **JavaScript/TypeScript**: Microsoft js-debug engine integration with ESM/CommonJS detection  
- **Python**: debugpy integration with framework-aware debugging
- **Java**: jdb integration with text-to-DAP protocol translation
- **Rust**: CodeLLDB integration with Cargo project analysis
- **Mock Adapter**: Complete DAP simulation for testing and development

## Internal Organization and Data Flow

### Request Processing Architecture
1. **Protocol Layer** - MCP requests arrive via stdio/SSE transports with protocol-safe handling
2. **Tool Dispatch** - Debug MCP server routes requests to appropriate debugging operations
3. **Session Orchestration** - Multi-layered session management coordinates debug operations and adapter communication
4. **Language Adaptation** - Dynamic adapter loading connects to language-specific debug backends
5. **Response Assembly** - Results flow back through MCP protocol with structured error handling

### Component Integration Flow
The system follows a layered architecture where MCP clients communicate with the debug server, which orchestrates multiple debug sessions through language-specific adapters, all while maintaining protocol compliance and providing comprehensive error handling and resource management.

### Quality Assurance Pipeline
- **Multi-Stage Testing** - Unit tests with comprehensive mocking → Integration tests with real toolchains → End-to-end workflow validation → Stress testing for production reliability
- **Cross-Platform Validation** - Windows, macOS, and Linux support with platform-specific testing and container-based deployment
- **Development Automation** - Complete CI/CD pipeline with pre-push validation, automated testing, and deployment preparation

## Important Patterns and Conventions

### Protocol-First Design
- **MCP Compliance** - All debugging operations exposed through standardized MCP tools enabling AI agent consumption
- **Transport Abstraction** - Clean separation between stdio and Server-Sent Events transport modes
- **Console Safety** - Comprehensive console output management preventing MCP protocol corruption

### Language-Agnostic Architecture  
- **Policy-Driven Behavior** - Eliminates hardcoded language logic through pluggable adapter system
- **Dynamic Discovery** - Runtime language detection with comprehensive environment validation
- **Unified Interface** - Consistent debugging experience across diverse programming language ecosystems

### Production Readiness
- **Dependency Injection** - Comprehensive DI system enabling testing isolation and modularity
- **Container-First Deployment** - Self-contained distributions with cross-platform binary inclusion
- **Resource Management** - Proper cleanup, timeout handling, and graceful shutdown across all components
- **Error Recovery** - Typed error hierarchy with semantic classification and recovery intelligence

This project represents a complete debugging solution that successfully bridges AI systems with traditional development tooling, providing a standardized interface for debugging operations while maintaining the flexibility and power required for professional software development across multiple programming languages and deployment environments.
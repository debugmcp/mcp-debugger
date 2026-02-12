# (root)/
@generated: 2026-02-11T23:49:17Z

## Overall Purpose and Responsibility

This repository serves as the **MCP Debugger** - a complete debugging ecosystem that bridges AI agents with multi-language debugging capabilities through the Model Context Protocol (MCP). The system transforms language-specific debugging tools into a unified, protocol-compliant platform that enables AI agents to perform sophisticated debugging operations (step-through execution, breakpoint management, variable inspection, expression evaluation) across Python, JavaScript/TypeScript, Rust, and Go applications.

## System Architecture and Component Integration

The repository follows a sophisticated multi-layered architecture that orchestrates debugging capabilities across the entire development lifecycle:

### Core Debugging Infrastructure (`src/`)
- **MCP Server Layer**: Primary debugging interface exposing 16 standardized debugging tools through MCP protocol
- **Session Management**: Centralized debug session orchestration with lifecycle control and state management
- **DAP Proxy System**: Sophisticated intermediary layer translating between MCP semantics and Debug Adapter Protocol
- **Multi-Language Adapters**: Dynamic adapter registry supporting Python (debugpy), JavaScript (js-debug), Go (Delve), and Rust (CodeLLDB)

### Language Adapter Ecosystem (`packages/`)
- **Shared Foundation**: Type-safe abstraction layer with unified interfaces (`IDebugAdapter`, `AdapterFactory`) ensuring consistent behavior
- **Language-Specific Implementations**: Complete debugging adapters with native toolchain integration and cross-platform compatibility
- **Production Distribution**: Standalone CLI tools (`mcp-debugger/`) bundling all components for npm/npx deployment

### Development and Automation Infrastructure
- **Build System (`scripts/`)**: Comprehensive build, test, and deployment automation with MCP protocol compliance
- **Testing Framework (`tests/`)**: Multi-layered validation covering unit tests, integration workflows, and end-to-end debugging scenarios
- **Development Environment (`docker/`)**: Containerized debugging with remote debugging support and workspace integration

### Educational and Demonstration Resources
- **Examples Directory**: Comprehensive demonstration suite with language-specific debugging scenarios, autonomous agent demos, and visualization tools
- **Runtime Launcher (`mcp_debugger_launcher/`)**: Cross-platform CLI tool providing runtime-agnostic server launching with intelligent environment detection

## Key Entry Points and Public API Surface

### Primary Integration Points
- **`createDebugMcpServer(options)`**: Main factory function for embedding MCP debugging capabilities in applications
- **CLI Commands**: 
  - `npx @debugmcp/mcp-debugger stdio` - Standard MCP protocol integration
  - `npx @debugmcp/mcp-debugger sse` - HTTP-based debugging with Server-Sent Events
- **MCP Debugging Tools**: 16 standardized tools accessible via MCP protocol:
  - Session management (`debug_session_create`, `debug_session_list`, `debug_session_destroy`)
  - Execution control (`debug_step_over`, `debug_step_into`, `debug_continue`)
  - Breakpoint management (`debug_set_breakpoint`, `debug_list_breakpoints`)
  - Runtime inspection (`debug_get_variables`, `debug_get_stack_trace`)
  - Expression evaluation (`debug_evaluate_expression`)

### Developer Experience Entry Points
- **Language Adapter Factories**: Standardized creation patterns for each supported language with automatic environment validation
- **Docker Integration**: `docker run` deployment with integrated debugging infrastructure
- **Educational Resources**: Progressive complexity examples from basic variable inspection to advanced concurrent debugging scenarios

## Critical Integration Patterns

### MCP Protocol Compliance
The entire system is architected around MCP protocol requirements, with console output silencing, structured tool schemas, and transport-agnostic design enabling seamless integration with AI agents and development environments like Claude Code.

### Multi-Language Debugging Strategy
The system provides VS Code-quality debugging experiences across multiple languages through native toolchain integration while maintaining a unified interface. Each language adapter handles platform-specific requirements (virtual environments, build systems, runtime detection) while implementing shared debugging contracts.

### Production Deployment Architecture
The system supports multiple deployment scenarios:
- **Container Mode**: Docker-based deployment with stdio transport for isolated environments
- **HTTP Mode**: Server-Sent Events transport for web-based integrations with multi-session support
- **Development Mode**: Rich CLI tooling with binary analysis and debugging workflow validation

### Quality Assurance Framework
Comprehensive testing infrastructure validates the complete debugging ecosystem through layered validation covering protocol compliance, cross-platform compatibility, language-specific integration, and production deployment scenarios.

This repository represents a complete, production-ready solution that successfully democratizes sophisticated debugging capabilities for AI agents, transforming complex language-specific debugging tools into a unified, accessible platform that maintains the full power and flexibility of native debugging workflows.
# (root)/
@generated: 2026-02-10T01:21:37Z

## Overall Purpose and Responsibility

This is the **Debug MCP (Model Context Protocol) Server** - a comprehensive AI-enabled debugging platform that bridges the gap between AI agents and development environments. The system transforms traditional IDE debugging capabilities into a standardized protocol that allows AI assistants to debug code across multiple programming languages (Python, JavaScript/TypeScript, Java, Go, Rust) through a unified interface. It serves as both a standalone CLI tool and an embeddable debugging service for AI agent integration.

## System Architecture and Component Integration

### Core Infrastructure Stack

The project follows a sophisticated multi-layered architecture with clean separation of concerns:

**1. MCP Protocol Layer** (`src/server.ts`, `src/index.ts`)
- Exposes 20+ debugging tools through standardized MCP protocol with JSON Schema validation
- Handles AI agent communication via stdio, SSE, and HTTP transports
- Provides unified debugging interface abstracting language-specific complexities

**2. Debug Adapter Ecosystem** (`packages/`)
- Six specialized language adapters implementing Debug Adapter Protocol (DAP) compliance
- Each adapter integrates with native debugging tools (Delve, JDB, js-debug, debugpy, CodeLLDB)
- Shared foundation library providing common abstractions and policy-driven customization
- Standalone CLI distribution packaging all adapters into deployable tool

**3. Session Management and Orchestration** (`src/session/`, `src/proxy/`)
- Multi-session debugging support with sophisticated proxy architecture
- Complete debug session lifecycle management with state coordination
- Policy-based command routing enabling complex debugging scenarios

**4. Development and Deployment Infrastructure** (`scripts/`, `docker/`, `mcp_debugger_launcher/`)
- Comprehensive build automation and CI/CD pipeline with cross-platform support
- Docker containerization with integrated development environment and remote debugging
- Intelligent runtime launcher with automatic environment detection (Node.js/Docker)

### Integration Flow and Data Architecture

```
AI Agent → MCP Protocol → Debug Server → Session Manager → Language Adapter → Native Debugger → Target Process
```

The system coordinates through:
- **Dependency Injection Container**: Centralized service wiring with production/test configurations
- **Adapter Registry**: Dynamic discovery and loading of language-specific debugging capabilities  
- **Event-Driven Architecture**: Loose coupling through EventEmitter patterns across all components
- **Functional Core/Imperative Shell**: Pure state transformations with side-effect management

## Public API Surface and Entry Points

### Primary Integration Points

**MCP Server API**:
- `createDebugMcpServer()`: Factory for complete debugging server with all language support
- 20+ MCP tools including: `debug_start_session`, `debug_set_breakpoint`, `debug_step_over`, `debug_get_variables`, `debug_evaluate_expression`
- Multi-transport support: stdio (default for Claude Code), SSE (web interfaces), HTTP

**CLI Distribution**:
- `@debugmcp/mcp-debugger`: npm-installable standalone debugger
- `mcp-debugger-wrapper.sh`: Intelligent transport detection for IDE integration
- Cross-platform launcher with automatic runtime selection (npx vs Docker)

**Language Adapter Factories**:
- `GoAdapterFactory`, `JavascriptAdapterFactory`, `PythonAdapterFactory`, `RustAdapterFactory`, `JavaAdapterFactory`
- Each implementing `IAdapterFactory` with environment validation and debugging capability exposure

### Development and Deployment APIs

**Environment Setup**:
- `scripts/install-claude-mcp.sh`: Automated Claude Code MCP server configuration
- `scripts/setup/`: Platform-specific development environment configuration
- Docker containerization with `/workspace` volume mounting for live development

**Testing and Validation**:
- Comprehensive test suite covering 19 MCP tools × 6 languages = 114 debugging scenarios
- Integration testing with real debugging workflows and protocol compliance validation
- Stress testing and transport layer parity validation

## Key Architectural Patterns and Capabilities

### Multi-Language Debugging Unification
- **Protocol Abstraction**: Bridges between MCP (AI agent communication) and DAP (IDE debugging) protocols
- **Language-Agnostic Interface**: Consistent debugging experience regardless of target language
- **Environment Intelligence**: Automatic toolchain detection, runtime discovery, and build orchestration

### Production-Ready Deployment
- **Container-Native**: Complete Docker environment with remote debugging support
- **Cross-Platform Compatibility**: Windows, macOS, and Linux support with platform-specific optimizations
- **Intelligent Fallbacks**: Multiple runtime strategies with graceful degradation

### AI Agent Integration Focus
- **Console Silence**: Careful stdout/stderr management to prevent MCP protocol corruption
- **Structured Responses**: All debugging operations return JSON-structured results for AI consumption
- **Error Resilience**: Comprehensive error handling with recovery strategies and diagnostic information

This project represents a complete debugging ecosystem that successfully transforms complex, language-specific debugging workflows into a simple, standardized interface that AI agents can effectively utilize for autonomous code debugging and development assistance.
# src/
@children-hash: 23f0435fab4fc60e
@generated: 2026-02-16T08:25:08Z

## Overall Purpose and Responsibility

The `src` directory contains the complete implementation of Debug MCP Server - a Model Context Protocol (MCP) server that enables AI agents to perform step-through debugging across multiple programming languages. This is the primary source code directory that orchestrates debug adapter protocol (DAP) communication, proxy process management, and session lifecycle operations through a sophisticated dependency injection architecture.

## Key Components and Architecture

### Core Entry Point (`index.ts`)
Primary application bootstrap that handles critical initialization sequences including console output silencing (essential for MCP protocol integrity), CLI routing, and dependency container setup. Provides factory functions for server instances and manages environment-specific behavior for both host and containerized deployments.

### MCP Protocol Layer (`server.ts`)
Main MCP server implementation exposing 16 debug operations as MCP tools. Dynamically discovers available language adapters, validates debug sessions, and translates MCP tool calls into debug adapter protocol commands. Serves as the bridge between AI agents and the underlying debugging infrastructure.

### Debug Infrastructure
- **Session Management** (`session/`): Complete debug session lifecycle with state management, DAP communication, and debugging operations (stepping, breakpoints, evaluation)
- **Proxy System** (`proxy/`): Sophisticated DAP proxy enabling multi-session debugging with language-agnostic adapter communication and policy-driven behavior
- **DAP Core** (`dap-core/`): Functional, stateless DAP message processing engine with pure state transformations and effect-as-data pattern

### Language Support (`adapters/`)
Dynamic adapter discovery and management system enabling pluggable debugger support through:
- Progressive package resolution with fallback strategies
- Factory registration and instance lifecycle management
- Auto-dispose functionality with resource cleanup

### Infrastructure Layers
- **Dependency Injection** (`container/`): Type-safe dependency container bootstrapping all system components
- **Concrete Implementations** (`implementations/`): Production Node.js implementations of all core abstractions
- **Interface Definitions** (`interfaces/`): Complete TypeScript contracts enabling testing and system integration
- **Utilities** (`utils/`): Cross-environment compatibility, file operations, error handling, and logging infrastructure

### CLI Framework (`cli/`)
Comprehensive command-line interface supporting multiple transport modes (stdio, SSE), global error handling, and debugging utilities with consistent option interfaces and graceful shutdown coordination.

## Public API Surface and Data Flow

### Primary Entry Points
- **`createDebugMcpServer(options)`**: Main factory function for MCP server instances
- **MCP Tools**: 16 standardized tools for debug operations exposed through MCP protocol
- **CLI Commands**: stdio, SSE, and utility commands with standardized logging options
- **SessionManager**: Complete debug session management API
- **ProxyManager**: Debug adapter proxy process control

### Key Data Flow
1. **Initialization**: Container bootstraps dependencies → Server registers MCP tools → Adapter registry discovers languages
2. **Debug Request**: MCP client calls tool → Server validates session → SessionManager orchestrates operation → Proxy communicates with debug adapter → Results returned via MCP
3. **Session Lifecycle**: Session creation → Proxy spawning → Adapter connection → Debug operations → Cleanup and disposal

### Transport Architecture
- **Stdio Mode**: Direct MCP protocol communication for AI agent integration
- **SSE Mode**: HTTP-based Server-Sent Events for browser/web integration
- **Shared Server Pattern**: Single DebugMcpServer instance serves multiple connections

## Integration Patterns and System Design

### Dependency Injection Architecture
Complete constructor injection with interface-based dependencies enabling:
- Comprehensive testing through mock implementations
- Environment-specific behavior customization
- Clean separation between business logic and platform APIs

### Language Extensibility
Plugin architecture supporting both compile-time and runtime adapter discovery with standardized naming conventions (`@debugmcp/adapter-{language}`) and factory patterns enabling seamless addition of new language support.

### Cross-Environment Operation
Container-aware design with path resolution, environment detection, and deployment-specific behavior ensuring consistent operation across development, testing, and production environments.

### Error Handling Strategy
Typed error hierarchy extending MCP SDK errors, comprehensive timeout protection, graceful degradation patterns, and structured logging providing robust fault tolerance and debugging capabilities.

### Protocol Safety
Explicit console output silencing prevents MCP protocol corruption, structured logging through Winston, and careful coordination between transport layers ensuring reliable AI agent communication.

The `src` directory represents a complete, production-ready debugging infrastructure that bridges AI agents with multi-language debugging capabilities through clean abstractions, robust process management, and comprehensive error handling.
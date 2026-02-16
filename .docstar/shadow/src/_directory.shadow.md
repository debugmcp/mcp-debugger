# src/
@children-hash: b70f79745be106d3
@generated: 2026-02-16T09:13:30Z

## Overall Purpose and Responsibility

The `src` directory implements the complete Debug MCP (Model Context Protocol) Server - a sophisticated debugging infrastructure that bridges AI agents and debug adapters through standardized MCP tools. This system enables AI-driven debugging workflows by exposing debugging operations (breakpoints, stepping, variable inspection) as MCP tools while maintaining clean separation between protocol concerns, debugging logic, and language-specific adapter management.

## System Architecture and Component Integration

The codebase follows a **layered microkernel architecture** with distinct separation of concerns:

### Protocol and Transport Layer
- **Entry Point (`index.ts`)**: Application bootstrapping with console silencing, CLI routing, and dependency wiring
- **Server (`server.ts`)**: Core MCP server exposing 16 debugging tools with dynamic language discovery and container-aware operation
- **CLI (`cli/`)**: Multi-transport command interface supporting stdio, SSE, and utility commands with robust error handling

### Core Debugging Engine
- **Session Management (`session/`)**: Complete debug session lifecycle management with layered architecture (storage → core → data → operations)
- **Proxy System (`proxy/`)**: Sophisticated DAP proxy enabling language-agnostic debugging through policy-driven architecture and multi-session support
- **DAP Processing (`dap-core/`)**: Functional, stateless Debug Adapter Protocol processing engine using pure functions and effect-as-data patterns

### Infrastructure and Adaptation
- **Language Adapters (`adapters/`)**: Dynamic adapter discovery and lifecycle management with pluggable architecture
- **Process Management (`implementations/`)**: Production-ready Node.js implementations of all core abstractions
- **Dependency Container (`container/`)**: Type-safe dependency injection system bootstrapping the entire application
- **Utilities (`utils/`)**: Cross-environment compatibility layer with path resolution, file processing, and validation

### Supporting Systems
- **Error Management (`errors/`)**: Comprehensive typed error hierarchy extending MCP SDK with debugger-specific semantics
- **Factory Pattern (`factories/`)**: Centralized object creation with dependency injection and testing infrastructure
- **Interface Contracts (`interfaces/`)**: Complete abstraction layer defining system boundaries and enabling testability

## Key Data Flow Patterns

### MCP Tool Execution Flow
1. **MCP Client** → **Server** (tool call) → **SessionManager** (debug operation) → **ProxyManager** (DAP communication) → **Debug Adapter** → **Target Process**
2. **Response Path**: Results flow back through the same layers with language policy filtering and structured error handling

### Session Lifecycle Management
1. **Session Creation**: Container bootstraps dependencies → Factory creates SessionManager → SessionStore manages state
2. **Debug Operations**: Operations layer validates → sends DAP requests → updates session state → returns structured results
3. **Event Processing**: Proxy events → Core layer state transitions → Operations layer debug event handling

### Cross-Environment Operation
1. **Environment Detection** → **Path Resolution** → **File Operations** → **Proxy Spawning** → **DAP Communication**
2. All layers respect container vs host deployment with consistent path handling and process management

## Public API Surface

### Primary Entry Points

**MCP Server Interface**:
- `createDebugMcpServer(options: ServerOptions)` - Main server factory
- 16 MCP tools organized into categories:
  - **Session Management**: create_debug_session, list_debug_sessions, close_debug_session
  - **Debugging Control**: start_debugging, attach_to_process, step_over, step_into, step_out, continue_execution, pause_execution
  - **Inspection**: get_variables, get_local_variables, get_stack_trace, get_scopes, evaluate_expression
  - **Discovery**: list_supported_languages, get_source_context

**CLI Interface**:
- `handleStdioCommand()` - Primary stdio transport mode
- `handleSSECommand()` - HTTP-based Server-Sent Events transport
- `handleCheckRustBinaryCommand()` - Binary analysis utility

**Programmatic APIs**:
- `SessionManager` - Complete debug session management facade
- `ProxyManager` - DAP proxy orchestration with multi-session support
- `AdapterRegistry` - Dynamic language adapter discovery and lifecycle management

### Configuration and Integration Points

**Server Configuration**:
- `ServerOptions` - Logging and container-aware configuration
- `ProxyConfig` - Language-agnostic proxy setup with adapter policies
- `ContainerConfig` - Cross-environment deployment configuration

**Extension Points**:
- Adapter Policy System - Language-specific behavior customization
- Factory Pattern - Custom object creation and dependency injection
- Event System - Comprehensive debugging event emission for integration

## Critical System Patterns

**Container-First Design**: All components handle host vs container deployment transparently through centralized path resolution and environment detection.

**Policy-Driven Architecture**: Language-specific behavior implemented through pluggable adapter policies rather than hardcoded logic, enabling extensibility.

**Functional Core with Effectful Shell**: DAP processing uses pure functions with effect-as-data patterns while maintaining stateful session management at higher layers.

**Comprehensive Error Semantics**: Typed error hierarchy with recoverability hints enables robust error handling and automated recovery strategies.

**Multi-Transport Protocol Support**: Clean separation between MCP protocol logic and transport mechanisms (stdio, SSE) enables deployment flexibility.

The `src` directory represents a complete debugging infrastructure that transforms complex debug adapter protocols into simple MCP tools, enabling AI agents to perform sophisticated debugging operations through standardized interfaces while maintaining language extensibility and cross-environment compatibility.
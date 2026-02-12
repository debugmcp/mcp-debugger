# tests\core\unit\server/
@generated: 2026-02-12T21:01:00Z

## Purpose
Unit test suite for the DebugMcpServer core functionality, providing comprehensive test coverage for the Model Context Protocol (MCP) debugging server implementation. This directory contains all unit tests for server initialization, lifecycle management, tool handlers, and debugging session operations.

## Key Components and Architecture

### Test Infrastructure (`server-test-helpers.ts`)
Central mock factory providing comprehensive test doubles for:
- **Dependency injection container** with file system, logger, environment, and path utilities
- **MCP server components** (Server, StdioServerTransport) 
- **SessionManager** with full debugging capabilities mock
- **Tool handler extraction** utilities for testing MCP protocol interactions

### Core Server Testing
- **`server-initialization.test.ts`** - Server constructor, dependency injection, and MCP tool registration
- **`server-lifecycle.test.ts`** - Start/stop operations, resource cleanup, and error handling
- **`dynamic-tool-documentation.test.ts`** - Tool documentation generation and MCP response serialization

### Tool Handler Test Suites
The server exposes 14 debugging tools through MCP protocol, tested across specialized files:

#### Session Management Tools (`server-session-tools.test.ts`)
- `create_debug_session` - Session creation with language validation
- `list_debug_sessions` - Active session enumeration  
- `close_debug_session` - Session cleanup and termination

#### Control Tools (`server-control-tools.test.ts`)
- `start_debugging` - Debug session initialization with dry-run support
- `set_breakpoint` - Breakpoint management with conditional support
- Execution control: `step_over`, `step_into`, `step_out`, `continue_execution`, `pause_execution`

#### Inspection Tools (`server-inspection-tools.test.ts`)
- `get_variables` - Variable inspection by scope
- `get_stack_trace` - Call stack examination
- `get_scopes` - Available scope enumeration
- `evaluate_expression` and `get_source_context` - Runtime evaluation and source access

### Language Discovery (`server-language-discovery.test.ts`)
Tests dynamic language detection and adapter registry integration:
- Supported language enumeration via `AdapterRegistry`
- Language metadata generation and validation
- Container environment detection for Python/Node.js
- Fallback mechanisms for discovery failures

## Testing Patterns and Conventions

### Mock Strategy
- **Comprehensive mocking** of all external dependencies using Vitest
- **Dependency injection testing** through mock factory pattern
- **MCP protocol simulation** with request/response validation
- **Error boundary testing** for both MCP errors and runtime failures

### Tool Testing Pattern
1. Extract `callToolHandler` from mocked server
2. Invoke tools with MCP-compliant request structure
3. Parse JSON responses from `result.content[0].text`
4. Validate both success paths and error scenarios

### Error Handling Evolution
Tests validate the server's evolution from exception-throwing to graceful error responses:
- **MCP parameter validation** returns proper `McpError` with `InvalidParams`
- **Runtime/session errors** return success responses with error messages in content
- **Upstream failures** are logged and propagated appropriately

## Public API Surface
The test suite validates all 14 MCP tools exposed by DebugMcpServer:
- **3 session tools** - create, list, close debug sessions
- **6 control tools** - debugging execution control and breakpoint management  
- **5 inspection tools** - runtime state examination and evaluation

## Key Dependencies
- **Vitest** - Primary testing framework with comprehensive mocking
- **@modelcontextprotocol/sdk** - MCP server and transport abstractions
- **Internal components** - DebugMcpServer, SessionManager, AdapterRegistry
- **Shared utilities** - Cross-platform path handling, logging, file system operations

## Integration Points
Tests validate proper integration between:
- MCP protocol compliance and tool handler registration
- Dependency injection and mock substitution
- Session lifecycle management and adapter registry
- Error propagation from SessionManager to MCP responses
- Dynamic language discovery and session creation validation

This test suite ensures the DebugMcpServer correctly implements the MCP protocol while providing robust debugging capabilities across multiple programming languages and development environments.
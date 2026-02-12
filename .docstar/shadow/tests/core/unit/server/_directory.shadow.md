# tests/core/unit/server/
@generated: 2026-02-11T23:47:45Z

## Purpose
Comprehensive unit test suite for the core DebugMcpServer functionality, providing complete coverage of server lifecycle, tool handlers, session management, and debugging operations. This directory validates the MCP (Model Context Protocol) server implementation that enables AI agents to perform debugging operations on various programming languages.

## Key Components

### Test Structure
- **Test Infrastructure** (`server-test-helpers.ts`) - Centralized mock factory providing comprehensive dependency injection mocks for logger, file system, environment, process/network managers, path utilities, and adapter registry
- **Lifecycle Testing** (`server-lifecycle.test.ts`) - Server start/stop operations and error handling
- **Initialization Testing** (`server-initialization.test.ts`) - Constructor behavior, configuration validation, and MCP tool registration
- **Tool Testing** - Comprehensive validation of all 14 debugging tools:
  - **Session Tools** (`server-session-tools.test.ts`) - create/list/close debug sessions
  - **Control Tools** (`server-control-tools.test.ts`) - breakpoints, execution control (step, continue, pause)
  - **Inspection Tools** (`server-inspection-tools.test.ts`) - variables, stack traces, scopes

### Specialized Testing Areas
- **Language Discovery** (`server-language-discovery.test.ts`) - Dynamic language detection, adapter registry integration, metadata generation
- **Documentation Validation** (`dynamic-tool-documentation.test.ts`) - Tool parameter descriptions and MCP response serialization

## Public API Surface
The test suite validates the complete MCP tool interface:

### Session Management
- `create_debug_session` - Session creation with language validation
- `list_debug_sessions` - Active session enumeration  
- `close_debug_session` - Session cleanup

### Debugging Control
- `set_breakpoint` - Breakpoint management with conditional support
- `start_debugging` - Session initialization with dry-run mode
- `step_over/step_into/step_out` - Code execution stepping
- `continue_execution/pause_execution` - Execution flow control

### Runtime Inspection  
- `get_variables` - Variable scope inspection
- `get_stack_trace` - Call stack examination
- `get_scopes` - Frame scope analysis
- `evaluate_expression` - Runtime expression evaluation
- `get_source_context` - Source code context retrieval

## Internal Organization & Data Flow

### Testing Architecture
1. **Mock Setup** - `server-test-helpers.ts` provides unified mock creation for all server dependencies
2. **Test Isolation** - Each test file focuses on specific functionality areas with comprehensive beforeEach/afterEach lifecycle
3. **Tool Handler Testing** - Consistent pattern using `getToolHandlers()` to extract and test MCP tool implementations
4. **Error Boundary Testing** - Validates both MCP parameter validation errors and graceful operational error handling

### Key Patterns
- **Dependency Injection Testing** - Validates proper mock injection through production dependency container
- **MCP Protocol Compliance** - Tests proper request/response structures and error codes
- **Session Lifecycle Management** - Validates debugging session state transitions and cleanup
- **Language Adapter Integration** - Tests dynamic language discovery and adapter registry interactions

## Important Testing Conventions

### Mock Strategy
- Uses Vitest framework with comprehensive `vi.mock()` for external dependencies
- Centralizes all mock creation through helper functions for consistency
- Follows dependency injection pattern with mock container replacement

### Error Handling Patterns
- **MCP Validation Errors** - Returns `McpError` with appropriate error codes for parameter validation
- **Operational Errors** - Returns success responses containing error messages for runtime failures
- **Graceful Degradation** - Tests fallback behaviors when optional components fail

### Response Validation
- All tool responses follow JSON structure: `{success: boolean, content: [{type: 'text', text: string}]}`
- Consistent parsing pattern: `JSON.parse(result.content[0].text)`
- Validates both success and error response formats

## Dependencies
- **Vitest** - Testing framework with mocking capabilities
- **@modelcontextprotocol/sdk** - MCP server and transport abstractions
- **Core Server Components** - DebugMcpServer, SessionManager, AdapterRegistry
- **Shared Types** - Language definitions, session states, and protocol interfaces

This test suite ensures the DebugMcpServer provides a robust, well-documented MCP interface for AI agents to perform comprehensive debugging operations across multiple programming languages.
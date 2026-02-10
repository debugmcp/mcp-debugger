# tests/core/unit/server/server-initialization.test.ts
@source-hash: 505ec4fcb10637b9
@generated: 2026-02-09T18:14:20Z

## Primary Purpose
Test suite for DebugMcpServer initialization, configuration, and tool handler registration using Vitest framework.

## Test Structure

### Main Test Suite (L25-177)
- **Constructor Tests (L50-111)**: Validates server initialization with different configurations
- **Tool Handler Tests (L113-176)**: Verifies tool registration and execution behavior

### Key Test Scenarios

#### Server Initialization (L51-96)
- Tests correct MCP server configuration with name/version metadata (L54-57)
- Validates dependency injection with various log configurations (L66-81)
- Handles dependency creation failures gracefully (L83-89)
- Confirms tool handler registration count (L91-96)

#### Error Handling (L98-110)
- Sets up error handler on MCP server instance (L101)
- Routes server errors to dependency logger (L109)

#### Tool Registration Verification (L114-140)
- Tests `tools/list` endpoint returns all 14 required debug tools
- Validates presence of core debugging tools:
  - Session management: `create_debug_session`, `list_debug_sessions`, `close_debug_session`
  - Breakpoint control: `set_breakpoint`, `start_debugging`
  - Execution control: `step_over`, `step_into`, `step_out`, `continue_execution`, `pause_execution`
  - Inspection: `get_variables`, `get_stack_trace`, `get_scopes`, `evaluate_expression`, `get_source_context`

#### Error Scenarios (L142-176)
- Unknown tool handling with proper error messages (L142-153)
- Tool execution failure propagation with logging (L155-175)

## Dependencies & Mocking

### Mocked Components (L20-23)
- `@modelcontextprotocol/sdk/server/index.js` - Core MCP server
- `@modelcontextprotocol/sdk/server/stdio.js` - STDIO transport
- `../../../../src/session/session-manager.js` - Session management
- `../../../../src/container/dependencies.js` - Dependency injection

### Test Setup (L32-44)
Creates comprehensive mock ecosystem with production dependencies, MCP server, STDIO transport, and session manager instances.

## Configuration Testing
Tests log file path resolution for session log directory derivation (L67-81), ensuring platform-specific path handling using Node.js path utilities.

## Architecture Validation
Confirms DebugMcpServer properly integrates with MCP SDK patterns:
- Server metadata registration
- Capability declaration (`tools: {}`)
- Request handler registration
- Error handling setup
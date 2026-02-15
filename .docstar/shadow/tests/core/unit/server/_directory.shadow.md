# tests\core\unit\server/
@children-hash: 69aa334607c3d85d
@generated: 2026-02-15T09:01:30Z

## Purpose
Unit test directory for the core MCP (Model Context Protocol) Debug Server, providing comprehensive test coverage for server initialization, lifecycle management, tool implementations, and debugging session operations. This directory validates the server's ability to handle debugging operations through the MCP protocol.

## Key Test Components

### Test Infrastructure
- **server-test-helpers.ts**: Central mock factory providing comprehensive dependency injection mocks for all server components (logger, file system, session manager, adapter registry, MCP SDK components)
- **Mock Strategy**: Consistent mocking approach across all test files using shared utilities and Vitest framework
- **Setup Pattern**: Standardized beforeEach/afterEach lifecycle with mock creation and cleanup

### Server Core Tests
- **server-initialization.test.ts**: Validates server constructor, dependency injection, MCP tool registration (14 debugging tools), and error handling setup
- **server-lifecycle.test.ts**: Tests server start/stop operations, resource cleanup, and error propagation during lifecycle transitions
- **dynamic-tool-documentation.test.ts**: Ensures MCP tool descriptions provide environment-agnostic path guidance for AI agent consumption

### Tool Implementation Tests
- **server-control-tools.test.ts**: Tests debugging control operations (breakpoints, execution control, stepping) through MCP tool handlers
- **server-inspection-tools.test.ts**: Validates debugging inspection capabilities (variables, stack traces, scopes) with proper session state validation
- **server-session-tools.test.ts**: Tests session management operations (create, list, close) with comprehensive error handling

### Advanced Features Tests
- **server-language-discovery.test.ts**: Tests dynamic language detection, adapter registry integration, metadata generation, and container environment handling

## Internal Organization & Data Flow

### Test Architecture
1. **Mock Setup**: Each test file uses `createMockDependencies()` to establish consistent mock environment
2. **Server Creation**: Tests instantiate `DebugMcpServer` with mocked dependencies
3. **Tool Handler Extraction**: Tests extract MCP tool handlers (`ListTools`, `CallTool`) for validation
4. **Tool Invocation**: Tests call tools through MCP protocol structure and validate JSON responses

### Common Testing Patterns
- **Error Handling**: Tests validate both MCP parameter validation errors and graceful operational error responses
- **Session Validation**: Most debugging tools require active session validation before operation
- **Response Format**: All tools return structured JSON responses with success/error fields
- **Mock Verification**: Extensive use of `expect().toHaveBeenCalledWith()` for dependency interaction validation

## Public API Surface (Tool Handlers)

### Session Management Tools
- `create_debug_session`: Language validation, session creation with adapter registry integration
- `list_debug_sessions`: Active session enumeration with state information
- `close_debug_session`: Session cleanup and resource management

### Debugging Control Tools
- `set_breakpoint`: Breakpoint management with conditional support
- `start_debugging`: Session initialization with script execution
- `step_over/step_into/step_out`: Execution stepping operations
- `continue_execution`: Resume debugging execution
- `pause_execution`: Pause debugging (tested as unimplemented)

### Inspection Tools
- `get_variables`: Variable inspection within debugging scopes
- `get_stack_trace`: Stack frame retrieval and analysis
- `get_scopes`: Debugging scope enumeration
- `evaluate_expression`: Expression evaluation in debugging context
- `get_source_context`: Source code context retrieval

### Discovery Tools
- Language discovery with adapter registry integration
- Dynamic language support detection
- Container environment awareness

## Key Dependencies
- **MCP SDK**: Server framework and protocol implementation (`@modelcontextprotocol/sdk`)
- **SessionManager**: Core debugging session management
- **AdapterRegistry**: Language adapter plugin system
- **Vitest**: Testing framework with comprehensive mocking capabilities
- **Test Utilities**: Shared mock creation and validation helpers

## Important Patterns & Conventions
- **Consistent Mock Setup**: All tests use centralized mock factories for reproducible test environments
- **MCP Protocol Compliance**: Tests validate proper MCP request/response structures and error codes
- **Error Response Evolution**: Tests show migration from exception throwing to graceful error responses in tool outputs
- **Environment Agnostic**: Tool documentation tests ensure cross-platform compatibility
- **Comprehensive Coverage**: Tests cover happy paths, error scenarios, edge cases, and missing dependency situations
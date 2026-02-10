# tests/core/unit/server/
@generated: 2026-02-10T01:19:43Z

## Purpose
Comprehensive unit test suite for the DebugMcpServer core functionality, validating server initialization, tool registration, session management, debugging operations, and lifecycle management. This directory provides complete test coverage for the MCP (Model Context Protocol) debug server's core capabilities.

## Key Components and Organization

### Test Infrastructure
- **server-test-helpers.ts** - Centralized mock factory providing comprehensive test doubles for all server dependencies (logger, file system, session manager, adapter registry, MCP SDK components)
- **Mock Strategy** - Consistent mocking approach using Vitest with dependency injection pattern, ensuring isolated unit testing

### Core Server Testing
- **server-initialization.test.ts** - Tests server constructor, dependency injection, error handling, and MCP tool registration (validates all 14 debugging tools are properly registered)
- **server-lifecycle.test.ts** - Tests server start/stop operations, resource cleanup, and error propagation scenarios

### Tool Category Testing
- **server-control-tools.test.ts** - Tests debugging execution control tools (breakpoint management, step operations, continue/pause, start debugging)
- **server-inspection-tools.test.ts** - Tests debugging introspection tools (get_variables, get_stack_trace, get_scopes)
- **server-session-tools.test.ts** - Tests session management tools (create/list/close debug sessions)

### Specialized Feature Testing  
- **server-language-discovery.test.ts** - Tests dynamic language detection, adapter registry integration, and metadata generation
- **dynamic-tool-documentation.test.ts** - Tests MCP tool documentation generation with environment-agnostic path guidance

## Public API Surface (Test Coverage)
The test suite validates the complete MCP debugging tool interface:

### Session Management
- `create_debug_session` - Session creation with language validation
- `list_debug_sessions` - Active session enumeration
- `close_debug_session` - Session cleanup and termination

### Debugging Control
- `start_debugging` - Debug session initiation with script path and DAP arguments
- `set_breakpoint` - Breakpoint creation with conditional support
- `step_over/step_into/step_out` - Step-by-step execution control
- `continue_execution/pause_execution` - Execution flow control

### Runtime Inspection
- `get_variables` - Variable inspection by scope
- `get_stack_trace` - Call stack examination
- `get_scopes` - Scope hierarchy analysis
- `evaluate_expression` - Runtime expression evaluation
- `get_source_context` - Source code context retrieval

## Internal Organization and Data Flow

### Test Architecture Patterns
1. **Mock Setup/Teardown** - Consistent beforeEach/afterEach lifecycle with comprehensive mocking
2. **Tool Handler Testing** - Standardized pattern using `getToolHandlers(mockServer).callToolHandler` 
3. **Response Validation** - JSON parsing from `result.content[0].text` with structured assertions
4. **Error Testing** - Both MCP parameter validation errors and runtime error propagation

### Dependency Flow
- Tests validate proper dependency injection through `createProductionDependencies()`
- SessionManager integration with AdapterRegistry for language discovery
- MCP SDK server and transport layer abstractions
- File system and environment abstraction layer testing

## Important Patterns and Conventions

### Testing Methodology
- **Isolation** - Each test uses fresh mock instances to prevent test pollution
- **Integration Style** - Tests component interactions while maintaining unit test isolation
- **Error Boundary Testing** - Comprehensive coverage of both happy path and failure scenarios
- **Protocol Compliance** - Validates MCP protocol structure and error handling

### Mock Conventions
- File system operations default to optimistic responses (files exist, operations succeed)
- Cross-platform path handling with Windows/Unix compatibility
- Adapter registry mocks support `['python', 'mock']` languages by default
- Session managers include complete debugging API surface mocking

### Documentation Testing
- Validates environment-agnostic tool documentation (no hard-coded paths)
- Tests consistent terminology across debugging tools
- Ensures AI agent-friendly documentation patterns

This test suite serves as both validation and documentation of the DebugMcpServer's complete functionality, providing confidence in the server's ability to handle debugging workflows through the MCP protocol.
# tests/adapters/python/integration/
@generated: 2026-02-11T23:47:38Z

## Python Adapter Integration Tests

**Purpose**: Comprehensive integration test suite for the Python debugging adapter, validating real-world Python environment discovery and full debugging workflow functionality through MCP (Model Context Protocol) communication.

### Key Components

**env-utils.ts**: Environment preparation utility focused on ensuring Python installations with debugpy support are available, particularly for Windows CI environments. Implements intelligent Python discovery across system paths and handles debugpy installation when needed.

**python-discovery.test.ts**: Integration test validating Python executable discovery without mocks. Tests the adapter's ability to find and use Python executables on the system PATH, with special handling for Windows Microsoft Store Python redirects.

**python_debug_workflow.test.ts**: Full debugging workflow integration test exercising the complete debug session lifecycle including session creation, breakpoint management, execution control, stack inspection, and variable examination.

### Integration Architecture

All tests use real MCP client-server communication via stdio transport, explicitly avoiding mocks to validate actual system behavior. The flow follows this pattern:

1. **Environment Preparation**: `env-utils.ensurePythonOnPath()` ensures Python+debugpy availability
2. **MCP Communication**: Tests spawn the debug server as a subprocess and communicate via MCP protocol
3. **Real Debugging**: Tests execute actual Python scripts with real breakpoints and variable inspection

### Public API Surface

**Entry Points**:
- `ensurePythonOnPath(env)`: Main utility for Python environment preparation
- Debug server communication via MCP tools: `list_sessions`, `create_session`, `set_breakpoint`, `start_debugging`, `continue`, `get_stack_frames`, `get_scopes`, `get_variables`

### Internal Organization

**Environment Layer**: `env-utils.ts` handles Python discovery and PATH management
**Discovery Layer**: `python-discovery.test.ts` validates Python executable discovery
**Workflow Layer**: `python_debug_workflow.test.ts` tests end-to-end debugging scenarios

### Data Flow

1. Environment utilities prepare Python runtime with debugpy
2. MCP client establishes stdio transport to debug server subprocess
3. Server process handles DAP (Debug Adapter Protocol) conversion internally
4. Tests validate debugging operations through MCP tool calls
5. Cleanup ensures proper session and transport closure

### Key Patterns

- **Real Integration Testing**: No mocks - tests actual system behavior
- **Environment Isolation**: Filtered environment variables to force discovery behavior
- **CI-Friendly**: Extensive logging, failure artifact collection, and Windows-specific handling
- **Polling Strategies**: Asynchronous debug state monitoring with configurable timeouts
- **Dry Run Support**: Safe testing mode without full debugging execution

### Dependencies

- **@modelcontextprotocol/sdk**: MCP client communication
- **@debugmcp/shared**: Debug protocol type definitions  
- **@vscode/debugprotocol**: VS Code DAP compatibility
- **Node.js built-ins**: Process spawning, filesystem, and path utilities
- **Vitest**: Testing framework with integration test support

### Critical Constraints

- Requires actual Python installation with debugpy support
- Windows-specific PATH and environment handling
- Tests tagged with `@requires-python` for conditional execution
- Designed for CI environments with comprehensive error reporting and diagnostic logging
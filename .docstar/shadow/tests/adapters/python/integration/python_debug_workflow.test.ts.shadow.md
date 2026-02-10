# tests/adapters/python/integration/python_debug_workflow.test.ts
@source-hash: b71aa39e649405d4
@generated: 2026-02-09T18:14:28Z

## Purpose
Integration test suite for Python debug workflows using the MCP (Model Context Protocol) client SDK. Tests full debug session lifecycle including session creation, breakpoint management, execution control, and variable inspection.

## Key Components

### Test Server Management (L18-89)
- **startTestServer()** (L18-75): Initializes MCP client with StdioClientTransport, spawns debug server process
  - Uses SDK Client with capabilities for tools
  - Manages server process lifecycle via transport layer
  - Configures logging and environment variables including Python path
- **stopTestServer()** (L77-89): Cleanly shuts down client connection and server process

### Utility Functions
- **parseToolResult()** (L97-104): Extracts JSON data from MCP ServerResult responses
- **waitForStackFrames()** (L106-132): Polling function to wait for debugger to pause at breakpoints
- **delay()** (L95): Simple promise-based delay utility
- **persistFailurePayload()** (L298-308): Saves test failure data to logs directory for CI debugging

### Main Test Suite (L134-297)
Located in `describe()` block with 60-second timeout, requiring Python environment.

#### Test Configuration (L135-137)
- Uses `tests/fixtures/python/debug_test_simple.py` as test script
- Sets breakpoint at line 13 (variable assignment `c = a + b`)

#### Full Debug Session Test (L147-245)
Complete workflow testing:
1. **Session Management**: List sessions, create new session with Python language
2. **Breakpoint Setup**: Set breakpoint at specific file/line
3. **Execution Control**: Start debugging, continue to breakpoint
4. **Stack Inspection**: Get stack trace, verify frame details (function name, file, line)
5. **Variable Inspection**: Get scopes, extract local variables, verify values (a=5, b=10)
6. **Cleanup**: Close debug session

#### Dry Run Test (L247-296)
Tests debug session dry run functionality:
- Creates separate session for isolated testing
- Calls `start_debugging` with `dryRunSpawn: true` flag
- Verifies dry run response structure and state management
- Includes CI-specific failure logging for debugging

## Dependencies
- **Testing Framework**: Vitest for test runner and assertions
- **MCP SDK**: Client, StdioClientTransport for server communication
- **Debug Types**: DebugSessionInfo, StackFrame, Variable from shared package
- **Node.js**: Child process management, file system operations, path utilities
- **Environment**: Custom `ensurePythonOnPath()` utility for Python environment setup

## Architecture Patterns
- **Transport Layer Abstraction**: Uses MCP SDK's StdioClientTransport instead of direct process management
- **Polling Pattern**: `waitForStackFrames()` implements retry logic for async debug state
- **Environment Isolation**: Filters and configures environment variables for test reproducibility
- **Error Handling**: Comprehensive error logging with CI-specific failure persistence

## Critical Invariants
- Client must be initialized before any test operations
- Server process lifecycle managed by transport layer
- Absolute paths required for script and breakpoint operations
- Python environment must be available and configured
- Test timeouts account for debug adapter initialization overhead
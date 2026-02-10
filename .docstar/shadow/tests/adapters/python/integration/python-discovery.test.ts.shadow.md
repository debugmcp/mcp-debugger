# tests/adapters/python/integration/python-discovery.test.ts
@source-hash: af3df8242f530fa1
@generated: 2026-02-09T18:14:20Z

## Purpose & Responsibility
Integration test suite for Python discovery functionality in the MCP debugger adapter. Tests real Python executable detection on Windows systems without mocking, ensuring the adapter can find and use Python interpreters through automated discovery mechanisms.

## Test Structure
- **Main Test Suite (L12-139)**: `Python Discovery - Real Implementation Test` with `@requires-python` tag
- **Setup/Teardown (L15-68)**: Client connection management with 30-second timeout
- **Core Test (L70-134)**: Validates Python discovery through debug session creation
- **Utility Function (L141-151)**: Failure payload persistence for CI debugging

## Key Components

### Client Configuration (L21-25)
Creates MCP client with stdio transport to communicate with debugger server:
- Name: "python-discovery-test-client"
- Version: "0.1.0" 
- Capabilities: Basic tool support

### Environment Setup (L27-44)
- Filters environment variables to pass to server process (L27-32)
- Removes Python-specific env vars to force discovery: `PYTHON_PATH`, `PYTHON_EXECUTABLE` (L35-36)
- Ensures Python is on PATH for Windows CI environments (L38-44)
- Uses `ensurePythonOnPath()` utility function

### Server Connection (L46-58)
Spawns debugger server as Node.js child process:
- Command: `node dist/index.js --log-level debug`
- Uses filtered environment for clean discovery testing
- 30-second connection timeout

### Discovery Validation (L88-133)
Tests Python discovery through two-phase operation:
1. **Session Creation (L88-103)**: Creates debug session without explicit `pythonPath`
2. **Discovery Trigger (L105-127)**: Starts debugging with `dryRunSpawn: true` to test executable finding

### Error Handling & Debugging (L118-123, L141-151)
- Logs detailed failure information in CI environments
- Persists failure payloads to `logs/tests/adapters/failures/` with timestamps
- Graceful client cleanup in afterAll hook

## Dependencies
- **MCP SDK**: Client and stdio transport from `@modelcontextprotocol/sdk`
- **Test Framework**: Vitest for test execution
- **Environment Utils**: Custom `ensurePythonOnPath()` function
- **File System**: Node.js fs and path modules

## Critical Constraints
- **No Mocking Policy (L9-10)**: Explicitly tests real Python discovery implementation
- **Windows Focus (L10, L40, L73)**: Designed to catch Microsoft Store Python redirect issues
- **CI Environment Handling**: Special logging and debugging for continuous integration
- **Clean Environment**: Removes Python env vars to ensure discovery is actually tested

## Architecture Notes
- Uses dry-run debugging to avoid actual debugger startup
- Expects server to implement `create_debug_session`, `start_debugging`, and `close_debug_session` tools
- Tool results expected in specific JSON format with `content[0].text` structure
- Session lifecycle: create → start → close pattern
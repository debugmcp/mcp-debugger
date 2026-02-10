# tests/adapters/python/integration/python-discovery.test.ts
@source-hash: af3df8242f530fa1
@generated: 2026-02-10T00:41:12Z

## Purpose
Integration test for Python discovery functionality in the MCP debugger adapter. Tests the real Python executable discovery process (not mocked) to ensure proper Python detection across platforms, especially Windows where Microsoft Store redirects can cause issues.

## Key Components

**Main Test Suite (L12-139):** `Python Discovery - Real Implementation Test @requires-python`
- Sets up MCP client connection to test server
- Explicitly avoids mocking to test real Python discovery implementation
- Includes 30-second timeout for server connection (L58)

**Setup Logic (L15-58):** `beforeAll` hook
- Creates MCP Client with stdio transport (L21-25)
- Builds path to server script at `../../../../dist/index.js` (L19)
- Filters environment variables and removes `PYTHON_PATH`/`PYTHON_EXECUTABLE` (L27-36)
- Calls `ensurePythonOnPath()` for Windows CI compatibility (L39)
- Establishes stdio transport with debug logging enabled (L46-50)

**Core Test Case (L70-134):** `should find Python on Windows without explicit path`
- Creates debug session WITHOUT specifying `pythonPath` to force discovery (L90-99)
- Uses `dryRunSpawn: true` to avoid actually launching debugger (L113)
- Validates successful Python discovery through session creation and start_debugging calls
- Includes CI-specific failure logging and payload persistence (L118-123)

**Utility Functions:**
- `parseToolResult()` (L79-86): Extracts JSON from MCP tool response structure
- `persistFailurePayload()` (L141-151): Saves test failure data to logs directory for debugging

## Dependencies
- `@modelcontextprotocol/sdk` for MCP client/transport
- `./env-utils.js` for `ensurePythonOnPath()` utility
- Vitest testing framework
- Node.js path/fs/url modules

## Architecture Notes
- Test deliberately clears Python environment variables to ensure discovery mechanism is tested
- Windows-specific handling for CI environments where setup-python may not add Python to PATH
- Uses dry-run mode to test discovery without spawning actual Python processes
- Error handling includes detailed logging for CI debugging

## Critical Constraints
- Must NOT use mocks - tests real Python discovery implementation
- Requires Python to be available on system (tagged with `@requires-python`)
- Expected to fail on Windows if python3 is Microsoft Store redirect
- 30-second timeout reflects expected server startup time
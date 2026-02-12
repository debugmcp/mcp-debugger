# tests\adapters\python\integration\python-discovery.test.ts
@source-hash: ef87c123b8e5af84
@generated: 2026-02-12T21:00:38Z

## Primary Purpose
Integration test for Python discovery functionality in the MCP (Model Context Protocol) Python adapter. Tests the real-world Python executable discovery logic on Windows systems without mocking, ensuring the adapter can find Python installations through system PATH.

## Test Structure
**Main Test Suite (L12-143):** `Python Discovery - Real Implementation Test @requires-python`
- **Setup (L15-58):** Creates MCP client, configures environment, connects to server via stdio transport
- **Teardown (L60-68):** Closes client connection with error handling
- **Core Test (L70-138):** Windows-specific Python discovery validation

## Key Functions and Logic

### Environment Configuration (L27-44)
Filters environment variables and removes Python-specific overrides (`PYTHON_PATH`, `PYTHON_EXECUTABLE`) to force discovery. Uses `ensurePythonOnPath()` helper for Windows CI environments.

### Client Setup (L21-50)
- Creates MCP client with stdio transport to `dist/index.js` server
- Uses Node.js executable path (`process.execPath`) as command
- Passes debug logging and filtered environment

### Test Execution (L83-138)
1. **Tool Result Parser (L83-90):** Extracts JSON from MCP server responses
2. **Session Creation (L94-107):** Creates debug session without `pythonPath` to trigger discovery
3. **Discovery Validation (L110-131):** Starts debugging with `dryRunSpawn: true` to test Python executable resolution
4. **Failure Logging (L122-127):** Captures failure payloads in CI environments

### Utility Function
**persistFailurePayload (L145-155):** Writes test failure data to `logs/tests/adapters/failures/` with timestamps for debugging

## Dependencies
- **MCP SDK:** Client and stdio transport for server communication
- **Vitest:** Test framework (describe, it, expect, lifecycle hooks)
- **Node.js modules:** path, fs, url for file system operations
- **Local utilities:** env-utils.js for environment setup

## Critical Constraints
- **Windows-specific:** Test only runs on `win32` platform (L71-73)
- **No mocking:** Explicitly tests real Python discovery implementation (L9-10)
- **CI considerations:** Special handling for Windows CI environments where Python may be off PATH
- **30s timeout:** Extended timeout for server connection (L58)

## Architectural Notes
- Uses dry-run mode to avoid actually launching debugger processes
- Follows MCP tool calling protocol with JSON response parsing
- Implements comprehensive error logging for CI debugging
- Tests the Microsoft Store Python redirect issue on Windows
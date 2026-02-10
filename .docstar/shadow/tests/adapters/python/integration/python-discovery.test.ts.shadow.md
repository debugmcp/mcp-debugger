# tests/adapters/python/integration/python-discovery.test.ts
@source-hash: 2b36cf5ef2b2e301
@generated: 2026-02-10T21:25:34Z

## Python Discovery Integration Test

**Purpose**: Tests real Python executable discovery functionality without mocks, specifically validating that the Python adapter can find Python executables on the system path.

### Key Components

**Main Test Suite (L12-139)**: `Python Discovery - Real Implementation Test @requires-python`
- Uses real MCP client-server communication via stdio transport
- Explicitly avoids mocking to test actual discovery behavior
- Focuses on Windows compatibility where python3 may redirect to Microsoft Store

**Setup Phase (L15-58)**:
- Creates MCP Client instance (L21-25) with basic tool capabilities
- Constructs server script path relative to current file location (L19)
- Environment preparation (L27-44):
  - Filters environment variables to remove undefined values
  - Clears Python-specific env vars (`PYTHON_PATH`, `PYTHON_EXECUTABLE`) to force discovery
  - Calls `ensurePythonOnPath()` for Windows CI compatibility
  - Logs PATH variable in CI environments for debugging
- Establishes stdio transport to server process (L46-50) with debug logging
- 30-second timeout for connection establishment

**Core Test Case (L70-134)**:
- Validates Python discovery without explicit path specification
- Creates debug session without `pythonPath` argument to force discovery (L90-99)
- Attempts to start debugging with dry run mode (L105-116)
- Includes CI-specific failure payload persistence for debugging (L118-123)
- Expects successful discovery and dry run execution
- Clean up with session closure

**Utility Functions**:
- `parseToolResult()` (L79-86): Extracts JSON from MCP tool response structure
- `persistFailurePayload()` (L141-151): Saves test failure data to logs directory for CI debugging

### Dependencies
- MCP SDK client components for transport and communication
- `env-utils.js` for Python path management
- Node.js path/fs modules for file operations
- Vitest testing framework

### Architecture Patterns
- Integration test pattern with real subprocess communication
- Environment isolation through filtered environment variables
- Dry run execution for safe testing without actual debugging
- Failure artifact collection for CI troubleshooting

### Critical Constraints
- Must NOT use mocks - tests real implementation only
- Requires actual Python installation on test system
- Windows-specific handling for Microsoft Store python3 redirect issue
- Designed to fail meaningfully when Python discovery fails
# tests/e2e/mcp-server-smoke-sse.test.ts
@source-hash: 21a53b79b87f18c6
@generated: 2026-02-09T18:15:14Z

## End-to-End SSE Smoke Test for MCP Server

**Primary Purpose**: End-to-end integration test validating MCP server functionality over Server-Sent Events (SSE) transport. Tests complete debug workflow from server startup through client connection to debug session execution and cleanup.

### Key Components

**Global State Variables (L21-26)**:
- `mcpSdkClient`: MCP SDK client instance for server communication
- `sseServerProcess`: Child process running the SSE server
- `serverPort`: Dynamically allocated port number
- `distReady`: Build state flag to avoid redundant builds

**Core Test Infrastructure**:

**`afterEach` Cleanup (L29-84)**: Comprehensive teardown ensuring no leaked resources. Implements graceful shutdown with SIGTERM followed by SIGKILL fallback. Critical for test isolation and preventing port conflicts.

**`ensureDistBuild()` (L86-100)**: Lazy build system ensuring `dist/index.js` exists before server startup. Runs `pnpm build` only when needed, improving test performance.

**`findAvailablePort()` (L105-142)**: Dynamic port allocation using random port selection from ephemeral range (49152-65535). Includes retry logic and Windows-specific port release delays.

**`startSSEServer()` (L147-266)**: Robust server startup with comprehensive error handling:
- Multi-attempt retry logic (max 3 attempts)
- Comprehensive logging of stdout/stderr
- Deterministic readiness detection via `waitForPort`
- EACCES permission error handling
- 30-second startup timeout

### Test Cases

**Basic SSE Debug Test (L268-325)**: 
- Validates complete debug workflow using fibonacci.py example
- Tests MCP client connection via SSEClientTransport
- Uses shared `executeDebugSequence` utility from smoke-test-utils
- Includes proper debug session cleanup

**Cross-Directory Test (L328-396)**:
- Verifies server functionality when spawned from different working directory (temp dir)
- Tests path resolution robustness
- Identical workflow to basic test but with different spawn context

### Architecture Decisions

**Process Management**: Uses child_process.spawn with comprehensive error handling and output capture. Implements both graceful (SIGTERM) and forced (SIGKILL) shutdown patterns.

**Port Management**: Dynamic port allocation prevents conflicts in concurrent test environments. Includes platform-specific timing considerations for Windows.

**Build Integration**: Lazy evaluation of build requirements reduces test overhead while ensuring fresh builds when needed.

**Error Resilience**: Multi-layer error handling with retry logic, comprehensive logging, and deterministic readiness checks prevent flaky test behavior.

### Dependencies

- **External**: `@modelcontextprotocol/sdk` for MCP client and SSE transport
- **Internal**: `./smoke-test-utils.js` for shared debug sequence execution
- **Node.js**: Standard modules for process management, networking, and file system operations

### Critical Constraints

- 30-second timeout for all operations (TEST_TIMEOUT)
- Maximum 3 retry attempts for server startup
- Ephemeral port range (49152-65535) for dynamic allocation
- Graceful shutdown timeout of 2 seconds before SIGKILL
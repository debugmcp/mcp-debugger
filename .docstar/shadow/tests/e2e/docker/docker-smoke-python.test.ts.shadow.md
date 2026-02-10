# tests/e2e/docker/docker-smoke-python.test.ts
@source-hash: a331b1ed67bb6636
@generated: 2026-02-10T00:41:33Z

## Python Docker Debugging End-to-End Tests

**Purpose**: Comprehensive smoke tests for Python debugging functionality running inside Docker containers. Verifies that the debugger MCP (Model Context Protocol) server works correctly when containerized.

**Test Suite Structure**: `describe.skipIf(SKIP_DOCKER)` block (L21) with conditional execution based on `SKIP_DOCKER` environment variable (L19).

### Key Test Setup (L27-43)
- **beforeAll** (L27): Builds Docker image `mcp-debugger:test`, creates containerized MCP client with debug logging
- **Container Management**: Dynamic container naming with timestamps (L32), 240s timeout for Docker operations
- **Client Initialization**: Establishes MCP client connection to containerized debugger server (L39-40)

### Cleanup Handlers (L45-83)
- **afterAll** (L45): Closes debug sessions, container cleanup, conditional Docker log printing on test failure (L62-66)
- **afterEach** (L71): Per-test session cleanup with error tolerance (L78-80)

### Core Test Functions

#### Complete Debugging Cycle Test (L85-285)
**Primary validation of full debugging workflow:**
1. **Session Creation** (L95): Creates Python debug session named 'docker-python-smoke'
2. **Breakpoint Management** (L111): Sets breakpoint at line 11 (swap operation) in `simple_test.py`
3. **Debug Launch** (L128): Starts debugging with DAP launch args, validates paused state
4. **Stack Inspection** (L167): Retrieves and validates stack frames
5. **Variable State Verification** (L183): Checks variables before swap (a=1, b=2) and after swap (a=2, b=1)
6. **Step Execution** (L209): Performs step-over operation
7. **Expression Evaluation** (L243): Evaluates `a + b` expression, expects result "3"
8. **Execution Control** (L260): Continues execution to completion
9. **Session Termination** (L274): Proper session cleanup

#### Multiple Breakpoints Test (L287-325)
Tests concurrent breakpoint management at lines 10 and 11 in the same file.

#### Source Context Test (L327-369)
Validates source code retrieval with 3-line context window around line 10.

### Dependencies & Utils
- **Docker Utilities**: `buildDockerImage`, `createDockerMcpClient`, `hostToContainerPath`, `getDockerLogs` (L11)
- **Test Utilities**: `parseSdkToolResult` for response parsing (L12)
- **MCP SDK**: Client interface for debugger communication (L13)

### File Path Resolution
- **Root Directory**: Resolves to project root via `../../..` (L17)
- **Test Scripts**: Uses `examples/python/simple_test.py` for debugging scenarios (L87)
- **Path Mapping**: Converts host paths to container paths using `hostToContainerPath` (L88)

### Error Handling
- **Docker Log Retrieval**: Captures container logs on debugging failures (L153-157)
- **Graceful Cleanup**: Tolerates session cleanup errors (L52, L78)
- **Extended Timeouts**: 120s for main test, 60s for auxiliary tests due to Docker overhead

### Architecture Notes
- **Container Isolation**: Tests run in isolated Docker containers with proper cleanup
- **State Management**: Session IDs tracked across test lifecycle for proper cleanup
- **Debug Protocol**: Uses DAP (Debug Adapter Protocol) with justMyCode and stopOnEntry settings
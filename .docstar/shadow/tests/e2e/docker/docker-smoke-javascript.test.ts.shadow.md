# tests/e2e/docker/docker-smoke-javascript.test.ts
@source-hash: bd0a7da7c8f23345
@generated: 2026-02-10T00:41:33Z

## Purpose
End-to-end smoke tests for JavaScript debugging functionality in Docker containers. Tests MCP debugger protocol operations against a containerized JavaScript runtime environment to verify Docker-specific debugging workflows and path resolution.

## Key Components

### Test Configuration (L15-19)
- `ROOT`: Project root path resolution from test file location
- `SKIP_DOCKER`: Environment variable to conditionally skip Docker tests

### Test Suite Setup (L21-83)
- **beforeAll** (L27-43): Builds Docker image (`mcp-debugger:test`) and creates containerized MCP client with 4-minute timeout
- **afterAll** (L45-69): Cleanup with debug session closure, container teardown, and conditional log printing on test failure
- **afterEach** (L71-83): Per-test cleanup ensuring debug sessions are properly closed

### Main Test - Full Debugging Cycle (L85-287)
Comprehensive 9-step debugging workflow:
1. **Session Creation** (L94-107): Creates JavaScript debug session with container-specific naming
2. **Breakpoint Setting** (L109-122): Sets breakpoint at line 44 using container path
3. **Debug Start** (L124-194): Launches debugger with extensive error handling and Docker log extraction
4. **Stack Retrieval** (L199-213): Validates stack trace accessibility
5. **Variable Access** (L215-228): Tests local variable inspection
6. **Step Over** (L230-242): Verifies execution control
7. **Expression Evaluation** (L244-258): Tests code execution in debug context
8. **Continue Execution** (L260-269): Resumes program execution
9. **Session Closure** (L274-284): Clean session termination

### Step Into Test (L289-384)
Tests nested function stepping behavior:
- Sets breakpoint at line 48
- Validates step-into operation moves to `deepfunction` with lower line number
- Confirms stack frame transitions

### Step Over Constants Test (L386-466)
Tests stepping over top-level const declarations:
- Uses `test-simple.js` target file
- Sets breakpoint at line 3, validates step advances to line 4

### Multiple Breakpoints Test (L468-506)
Validates concurrent breakpoint management:
- Sets breakpoints at lines 44 and 53
- Confirms both succeed without interference

### Source Context Test (L508-550)
Tests source code retrieval functionality:
- Requests 3 lines of context around line 44
- Validates response contains source content in various possible formats

## Key Dependencies
- **Docker utilities** (L11): `buildDockerImage`, `createDockerMcpClient`, `hostToContainerPath`, `getDockerLogs`
- **SDK parsing** (L12): `parseSdkToolResult` for MCP response handling
- **MCP Client** (L13): Core debugging protocol client

## Architecture Patterns
- **Container Path Translation**: Uses `hostToContainerPath()` to convert host file paths to container-accessible paths
- **Extensive Error Handling**: Each critical operation includes try-catch with Docker log extraction for debugging
- **State Management**: Tracks `sessionId`, `containerName`, `cleanup` function across test lifecycle
- **Timeout Management**: Extended timeouts (60-120s) accommodate Docker operation overhead

## Critical Invariants
- All tests use container paths rather than host paths for file operations
- Sessions must be explicitly closed to prevent resource leaks
- Docker container cleanup is essential for test isolation
- Error states trigger comprehensive log collection for debugging
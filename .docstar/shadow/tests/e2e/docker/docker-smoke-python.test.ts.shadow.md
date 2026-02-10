# tests/e2e/docker/docker-smoke-python.test.ts
@source-hash: a331b1ed67bb6636
@generated: 2026-02-09T18:14:39Z

## Purpose
End-to-end smoke test suite validating Python debugging functionality within Docker containers. Verifies that all core debugging operations work correctly when the MCP debugger server runs in a containerized environment.

## Key Test Structure
- **Main test suite** (L21): `Docker: Python Debugging Smoke Tests` - conditionally skipped if `SKIP_DOCKER_TESTS=true`
- **Setup/teardown lifecycle**:
  - `beforeAll` (L27-43): Builds Docker image and starts containerized MCP server with 240s timeout
  - `afterAll` (L45-69): Cleans up debug sessions, containers, and prints logs on failure
  - `afterEach` (L71-83): Closes active debug sessions between tests

## Core Test Cases

### Full Debugging Cycle Test (L85-285)
Comprehensive integration test covering complete debugging workflow:
- **Session management** (L95-107): Creates Python debug session
- **Breakpoint operations** (L111-122): Sets breakpoint at line 11 of test script
- **Debug execution** (L128-160): Starts debugging with DAP launch args, expects paused state
- **Stack inspection** (L167-179): Retrieves and validates stack frames
- **Variable inspection** (L183-205, L223-239): Captures variables before/after swap operation
- **Step execution** (L209-219): Performs step-over operation
- **Expression evaluation** (L243-256): Evaluates `a + b` expression
- **Session lifecycle** (L274-282): Properly closes debug session

### Multi-Breakpoint Test (L287-325)
Validates setting multiple breakpoints at different lines (10, 11) in same file.

### Source Context Test (L327-369)
Tests source code retrieval with context lines around target line 10.

## Dependencies
- **Vitest framework** (L8): Test runner with describe/it/expect
- **Docker utilities** (L11): `buildDockerImage`, `createDockerMcpClient`, `hostToContainerPath`, `getDockerLogs`
- **MCP SDK** (L13): Client interface for tool execution
- **Test utilities** (L12): `parseSdkToolResult` for response parsing

## Key Configuration
- **Docker image**: `mcp-debugger:test`
- **Test script**: `examples/python/simple_test.py` with variable swap logic
- **Timeouts**: 240s for container setup, 120s for main test, 60s for smaller tests
- **Container naming**: `mcp-debugger-py-test-${timestamp}` for isolation

## Architecture Patterns
- **Path translation**: Converts host paths to container paths using `hostToContainerPath`
- **Error resilience**: Catches and logs Docker container logs on test failures
- **Session isolation**: Each test gets clean debug session state
- **Async coordination**: Uses `setTimeout` delays for operation stabilization
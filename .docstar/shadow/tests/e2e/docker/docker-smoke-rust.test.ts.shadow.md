# tests/e2e/docker/docker-smoke-rust.test.ts
@source-hash: 2cd38450379899ec
@generated: 2026-02-10T00:41:28Z

## Primary Purpose
End-to-end test suite validating Rust debugging functionality when MCP Debugger runs inside Docker containers. Tests the full debugging workflow including session management, breakpoints, stack traces, and variable inspection.

## Key Functions & Classes

**Test Configuration**
- `DOCKER_RUST_ENABLED` (L23): Environment flag controlling test execution
- `describeDockerRust` (L45): Conditional test runner based on environment flag
- `ensureSuccess()` (L31-36): Assertion helper validating MCP tool response success
- `toContainerAbsolute()` (L38-43): Converts relative paths to absolute container paths

**Core Test Infrastructure**
- `waitForStackFrame()` (L54-75): Polling mechanism for stack frame conditions with 20 attempts, 250ms intervals
- Test lifecycle hooks manage Docker container and MCP client lifecycle (L77-132)

**Test Cases**
1. **Basic Rust Debugging** (L134-198): Tests complete debug cycle with hello_world example
   - Creates debug session, sets breakpoint at line 26, starts debugging with `stopOnEntry: true`
   - Executes continue operations and verifies session cleanup
   
2. **Async Variable Inspection** (L200-282): Tests async Rust debugging with variable inspection
   - Uses async_example, sets breakpoint at line 46
   - Waits for stack frame matching source path, inspects local variables
   - Validates 'id' variable presence in locals

## Dependencies & Relationships
- **Docker utilities**: `buildDockerImage`, `createDockerMcpClient`, `hostToContainerPath`, `getDockerLogs` from `./docker-test-utils.js`
- **Rust examples**: `prepareRustExample` from `../rust-example-utils.js` 
- **MCP SDK**: Client interface for debug tool calls
- **Test utilities**: `parseSdkToolResult` for response parsing

## Architectural Patterns
- **Conditional testing**: Uses environment flags to skip tests when Docker Rust is disabled
- **Resource management**: Comprehensive cleanup in afterAll/afterEach hooks with error handling
- **Path translation**: Converts host paths to container paths for Docker execution
- **Async polling**: Implements retry logic for stack frame detection
- **Tool call pattern**: All MCP interactions use `callTool` with structured arguments

## Critical Constraints
- 240-second timeout for beforeAll Docker setup (L96)
- 120-second timeout per test case (L197, L281)
- Linux target compilation required for Docker compatibility
- Container workspace mounted at `/workspace/`
- Debug sessions must be explicitly closed to prevent resource leaks
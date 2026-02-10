# tests/e2e/mcp-server-java-attach.test.ts
@source-hash: 73ce9c9f7969f05a
@generated: 2026-02-10T21:25:40Z

## Purpose
End-to-end test suite for Java debug session attachment functionality via MCP (Model Context Protocol) interface. Tests the ability to attach to running Java processes with debug agents, set breakpoints, and cleanly detach without terminating the target process.

## Key Components

### Test Setup Functions
- `createAttachTestProgram()` (L36-67): Creates a simple Java program that runs in an infinite loop with a counter, designed for attach testing. Returns the Java file path.
- `compileJavaFile()` (L72-92): Compiles Java source files using `javac` with Promise-based error handling.
- `startJavaWithDebugAgent()` (L97-148): Launches Java process with JDWP debug agent enabled on port 5005, waits for "Listening for transport" confirmation before returning the ChildProcess.

### Test Configuration
- Debug port: 5005 (L26)
- Java toolchain detection: `hasJava` (L29-31) - checks `javac -version` availability
- Root directory resolution from test file location (L21-23)

### Test Suite Structure (L150-332)
The main describe block is conditionally skipped if Java toolchain is unavailable. Manages:

**Setup/Teardown:**
- `beforeAll` (L157-188): Creates test Java program, compiles it, starts Java process with debug agent, initializes MCP client connection
- `afterAll` (L190-206): Terminates Java process (SIGTERM then SIGKILL), closes MCP client and transport
- `afterEach` (L208-220): Closes debug sessions with 2-second delay for JDWP connection cleanup

**Test Cases:**
1. **Basic Attach** (L222-246): Validates successful attachment to running Java process via `create_debug_session` tool
2. **Breakpoint Setting** (L248-275): Tests setting breakpoints after attachment using absolute file paths
3. **Clean Detach** (L277-303): Verifies detachment doesn't terminate the target Java process
4. **Session Lifecycle** (L305-331): Tests complete create/close session workflow

## Dependencies
- **MCP SDK**: `@modelcontextprotocol/sdk` for client and transport
- **Test Framework**: Vitest for test runner and assertions
- **Process Management**: Node.js `child_process` for spawning Java processes
- **Utilities**: Custom `callToolSafely` from smoke-test-utils for MCP tool invocation

## Architecture Patterns
- **Conditional Test Execution**: Entire suite skipped if Java not available
- **Resource Lifecycle Management**: Careful cleanup of Java processes and MCP connections
- **Async Process Coordination**: Promise-based waiting for Java debug agent readiness
- **Host Binding Specificity**: Uses `127.0.0.1` explicitly to avoid IPv6 resolution issues

## Critical Constraints
- **Single JDWP Connection**: Only one debugger can attach to JDWP at a time, requiring 2-second delays between sessions
- **Port Conflicts**: Uses fixed port 5005 which could conflict with other debug sessions
- **Timeout Management**: 60-second test timeouts, 30-second attach timeouts, 15-second Java startup timeout
- **Process Cleanup**: Must ensure Java processes are terminated to prevent resource leaks
# tests/e2e/mcp-server-java-attach.test.ts
@source-hash: 791f30b36e792dfa
@generated: 2026-02-10T00:41:59Z

## Java Debug Attach E2E Test Suite

End-to-end test for attaching to running Java processes via MCP server debug interface. Tests Java Debug Wire Protocol (JDWP) attachment, breakpoint management, and detachment without process termination.

### Core Test Infrastructure

**Test Program Creation (L31-62)**
- `createAttachTestProgram()` - Generates AttachTestProgram.java with infinite loop and counter logic
- Creates simple Java program that outputs counter values and includes breakpoint target at line threshold

**Java Compilation & Execution (L67-143)**
- `compileJavaFile()` (L67-87) - Spawns javac process to compile Java source
- `startJavaWithDebugAgent()` (L92-143) - Launches Java with JDWP agent on port 5005
- Uses `-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=127.0.0.1:5005`
- Waits for "Listening for transport dt_socket" confirmation message

### Test Configuration

**Constants & Setup (L25-27, L152-183)**
- `DEBUG_PORT = 5005` - Fixed JDWP port for all tests
- Test timeout: 60 seconds for attach operations, 30 seconds for cleanup
- MCP client connects to `dist/index.js` with info logging enabled

**Session Management (L146-150)**
- Tracks: mcpClient, transport, sessionId, javaProcess, javaFile
- `afterEach()` (L203-215) - Closes debug sessions with 2-second delay for JDWP cleanup
- `afterAll()` (L185-201) - Terminates Java process (SIGTERM then SIGKILL) and closes MCP connection

### Test Scenarios

**Basic Attach Test (L217-241)**
- Creates debug session with explicit host `127.0.0.1` to avoid IPv6 issues
- Validates successful attachment and state transition
- Accepts states: 'initializing', 'paused', 'running', 'connected'

**Breakpoint Management (L243-270)**
- Sets breakpoint on line 20 (counter threshold check)
- Uses absolute file path resolution
- Validates breakpoint verification

**Detach Without Termination (L272-298)**
- Tests clean detachment that preserves target process
- Verifies `javaProcess.killed` remains false after session close

**Session Lifecycle (L300-326)**
- Full create/close cycle validation
- Ensures proper cleanup prevents double-close in afterEach

### Key Dependencies
- MCP SDK client with stdio transport
- `callToolSafely()` utility from smoke-test-utils
- Node.js child_process for Java compilation and execution
- Vitest testing framework

### Critical Constraints
- Single JDWP connection limit requires 2-second delays between tests
- Java process must be started before MCP client connection
- IPv4 binding (127.0.0.1) required to avoid resolution issues
- 15-second timeout for Java debug agent startup
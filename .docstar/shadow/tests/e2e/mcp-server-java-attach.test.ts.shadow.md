# tests/e2e/mcp-server-java-attach.test.ts
@source-hash: 791f30b36e792dfa
@generated: 2026-02-09T18:15:10Z

## Purpose
End-to-end test suite for Java process attachment functionality via MCP (Model Context Protocol) interface. Tests the ability to attach a debugger to an already running Java process, set breakpoints, and detach without terminating the target process.

## Test Architecture & Setup
- **Test Framework**: Vitest with MCP SDK client integration
- **Transport**: `StdioClientTransport` (L164) connecting to MCP server via Node.js subprocess
- **Debug Protocol**: Uses Java Debug Wire Protocol (JDWP) on port 5005 (L26)
- **Target Process**: Dynamically generated Java test program with debug agent enabled

## Key Components

### Test Program Generation
- `createAttachTestProgram()` (L31-62): Creates AttachTestProgram.java with infinite counter loop for attach testing
- `compileJavaFile()` (L67-87): Compiles Java source using spawned javac process
- `startJavaWithDebugAgent()` (L92-143): Launches Java process with JDWP agent, waits for "Listening for transport" confirmation

### Test Infrastructure
- **Setup** (L152-183): Creates test program, compiles it, starts Java process with debug agent, initializes MCP client
- **Cleanup** (L185-201): Terminates Java process (SIGTERM then SIGKILL), closes MCP connections
- **Per-test Cleanup** (L203-215): Closes debug sessions with 2-second delay for JDWP connection reset

### Core Test Cases
1. **Basic Attach** (L217-241): Verifies successful attachment to running process via `create_debug_session` with port parameter
2. **Breakpoint Setting** (L243-270): Tests setting breakpoints on attached process at specific source lines
3. **Clean Detach** (L272-298): Ensures detachment doesn't terminate target process
4. **Session Lifecycle** (L300-326): Tests complete create/close session cycle

## Critical Implementation Details
- Uses explicit IPv4 address (127.0.0.1) to avoid IPv6 resolution issues
- JDWP only allows single connection - requires 2-second delay between sessions
- Test timeouts set to 60 seconds for attach operations
- Debug agent started with suspend=n to keep process running during attach
- Breakpoint testing targets line 20 (counter threshold check in test program)

## Dependencies
- `@modelcontextprotocol/sdk`: MCP client and transport
- `callToolSafely`: Utility from smoke-test-utils for safe MCP tool invocation
- Standard Node.js modules: child_process, fs, path, util

## State Management
- `sessionId`: Tracks active debug session for cleanup
- `javaProcess`: Reference to spawned Java process for lifecycle management
- `mcpClient` & `transport`: MCP connection objects
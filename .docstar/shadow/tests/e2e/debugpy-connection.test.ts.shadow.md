# tests/e2e/debugpy-connection.test.ts
@source-hash: 7093f3fab5503db7
@generated: 2026-02-10T01:19:09Z

## Purpose
End-to-end test suite for MCP (Model Context Protocol) server's debugpy integration, validating the complete debugging workflow from connection establishment through execution control.

## Architecture & Dependencies
- **Testing Framework**: Vitest with Jest environment (L12)
- **Core Dependencies**: 
  - MCP SDK client with SSE transport (L20-21)
  - Node.js child processes for spawning debugpy/MCP servers (L13)
  - Native filesystem operations (L18-19)
- **Test Environment**: Uses real Python discovery without mocking (L23)

## Key Components

### Global State & Configuration (L28-32)
- `mcpSdkClient`: MCP SDK client instance for tool calls
- `debugpyProcess`/`mcpProcess`: Child process handles for cleanup
- `serverPort`: Dynamically allocated port for MCP server
- `TEST_TIMEOUT`: 60-second timeout for long-running operations

### Core Functions

**`cleanup()` (L35-104)**
- Centralized teardown function handling graceful shutdown sequence
- Closes debug sessions → SDK client → MCP process → debugpy process
- Includes 500ms socket close delay for proper cleanup

**`parseSdkToolResult()` (L107-114, L257-264)**
- Parses ServerResult responses from MCP SDK tool calls
- Extracts JSON content from nested structure: `result.content[0].text`
- Critical for interpreting tool responses throughout tests

**`findAvailablePort()` (L119-154)**
- Dynamically finds available ports in range 49152-65535
- Uses net server binding with retry logic (max 10 attempts)
- Includes Windows-specific 200ms delay for port release

**`startDebugpyServer()` (L156-190)**
- Spawns Python debugpy server using platform-specific executable
- Windows: `python`, Unix: `python3` (L169)
- Waits for "Debugpy server is listening!" confirmation message
- 5-second startup timeout with error handling

**`startMcpServer()` (L192-199)**
- Launches MCP server in SSE mode with debug logging
- Uses built dist/index.js with dynamic port allocation
- 3-second startup delay before returning process handle

## Test Structure

### Setup (L202-250)
1. Validates `dist/index.js` exists (build artifact check)
2. Starts debugpy server on default port 5679
3. Allocates random port and starts MCP server
4. Health check polling with 10-second timeout
5. Establishes MCP SDK client connection via SSE

### Test Cases

**Session Management Test (L266-289)**
- Creates/lists/closes debug sessions
- Validates session metadata (ID, name)
- Tests basic MCP tool functionality

**Full Debugging Workflow Test (L291-427)**
- Creates temporary Python script with fibonacci implementation
- Establishes debug session with `stopOnEntry: true`
- Sets breakpoint at line 4 (after sleep statement)
- Executes step-over and continue operations
- Validates stack trace inspection with frame details
- Ensures proper cleanup of temporary files

## Critical Patterns
- **Error Handling**: Comprehensive try-catch with detailed logging
- **Resource Management**: Always uses centralized cleanup in finally blocks
- **Timing**: Strategic delays for process synchronization (debugger readiness)
- **Platform Compatibility**: Windows/Unix executable path handling
- **Port Management**: Dynamic allocation to avoid conflicts in CI environments

## Test Constraints
- Requires Python runtime with debugpy package
- Depends on built MCP server (`dist/index.js`)
- Uses real network sockets and child processes
- 60-second timeout for complex debugging operations
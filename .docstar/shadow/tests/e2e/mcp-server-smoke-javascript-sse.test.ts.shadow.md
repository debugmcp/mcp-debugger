# tests/e2e/mcp-server-smoke-javascript-sse.test.ts
@source-hash: 9c223250b3965053
@generated: 2026-02-10T00:42:04Z

## Purpose
End-to-end test for MCP server's JavaScript debugging capabilities via SSE (Server-Sent Events) transport. Critical test that validates a production issue where console output during SSE server operation corrupts IPC channels, causing JavaScript debugging to fail with empty stack traces.

## Core Issue & Fix (L1-25)
Comprehensive comment block documents a critical production bug: console output during SSE mode corrupts IPC channels between parent-child-grandchild processes in JavaScript debugging architecture. The fix requires adding `hasSSE ||` to `shouldSilenceConsole` logic in `src/index.ts`. Without this fix, inherited stdio causes IPC corruption leading to ~35 second timeouts and empty stack traces.

## Test Architecture
- **Test Environment**: Jest/Vitest node environment with 60-second timeout (L38)
- **Global State**: Manages `mcpSdkClient`, `sseServerProcess`, and `serverPort` (L40-43)
- **Dependencies**: MCP SDK client/transport, child_process spawning, network utilities

## Key Functions

### `findAvailablePort()` (L107-144)
Port discovery utility with retry logic (max 10 attempts). Uses ephemeral port range 49152-65535, includes Windows-specific 200ms delay for port release.

### `startSSEServer()` (L154-247)
**CRITICAL FUNCTION**: Spawns SSE server with inherited stdio to match production environment (`start-sse-server.cmd`). Uses retry logic (max 3 attempts) and comprehensive error handling. Validates the console silencing fix by using inherited stdio that would trigger IPC corruption without proper silencing.

### `executeJavaScriptDebugSequence()` (L260-429)
Reproduces the reported debugging issue through complete debug workflow:
1. Creates debug session for JavaScript
2. Sets breakpoint at line 11 in test script
3. Starts debugging with configurable launch args
4. Polls for stack trace availability (with timeout/retry)
5. Retrieves local variables
6. Validates both stack frames and variables are populated

## Test Cases

### Main Test: `should successfully debug JavaScript via SSE transport` (L431-497)
Primary test that reproduces and validates the fix for the SSE IPC corruption issue. Uses inherited stdio and expects successful debugging after the console silencing fix is applied.

### Secondary Test: Default launch args test (L499-542)
Validates debugging works with null launch args (allowing default behavior) and deferred stack trace collection.

## Critical Patterns
- **Inherited stdio usage**: Matches production environment to validate IPC corruption fix
- **Graceful cleanup**: Two-stage process termination (SIGTERM → SIGKILL) with timeouts
- **Polling with timeouts**: Stack trace availability checked with configurable intervals
- **Comprehensive error context**: All failures include detailed error messages and state

## Dependencies
- `@modelcontextprotocol/sdk`: Client and SSE transport
- `smoke-test-utils.js`: Port waiting and SDK result parsing utilities
- Test target: `examples/javascript/simple_test.js` with breakpoint at line 11

## Constraints
- 60-second global timeout for all operations
- Inherited stdio required to match production environment
- Console silencing in SSE mode is mandatory for JavaScript debugging success
- Graceful shutdown patterns prevent resource leaks
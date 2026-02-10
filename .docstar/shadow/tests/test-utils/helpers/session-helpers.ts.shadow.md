# tests/test-utils/helpers/session-helpers.ts
@source-hash: 8ca72707a0900e14
@generated: 2026-02-10T00:41:27Z

## Purpose
Test helper utilities for debugging session management. Provides a singleton DebugMcpServer instance and wrapper functions for common debugging operations during integration testing.

## Architecture
- **Lazy Singleton Pattern**: Uses a module-level `debugServer` variable (L11) with lazy initialization via `getDebugServer()` (L13-21)
- **Server Configuration**: Initializes with debug logging and specific log file for test isolation (L15-18)
- **Wrapper Pattern**: All exported functions are thin wrappers around DebugMcpServer methods with added logging

## Key Components

### Server Management
- `getDebugServer()` (L13-21): Lazy initializer for singleton DebugMcpServer instance
- `cleanupTestServer()` (L24-36): Async cleanup function for test teardown, safely stops server and resets singleton

### Session Operations
- `createDebugSession()` (L39-42): Creates new debug session with language, optional name and Python path
- `closeDebugSession()` (L57-60): Closes existing debug session by ID
- `startDebugging()` (L45-54): Starts debugging with script path, args, DAP launch args, and dry-run option

### Debug Control Flow
- `continueExecution()` (L87-90): Resumes program execution
- `stepOver()` (L93-96): Step over current line
- `stepInto()` (L99-102): Step into function calls
- `stepOut()` (L105-108): Step out of current function

### Debugging Inspection
- `setBreakpoint()` (L63-66): Sets breakpoint at file:line with optional condition
- `getVariables()` (L69-72): Retrieves variables for given scope ID
- `getStackTrace()` (L75-78): Gets current call stack frames
- `getScopes()` (L81-84): Gets available scopes for specific frame

## Dependencies
- `DebugMcpServer` from `../../../src/server.js`: Core debugging server
- `@debugmcp/shared`: Type definitions for DebugSessionInfo, DebugLanguage, Breakpoint, Variable, StackFrame
- `@vscode/debugprotocol`: VSCode Debug Adapter Protocol types
- Logger utility for test-specific logging with 'debug-mcp:test-helpers' namespace (L7)

## Usage Patterns
All functions include extensive logging for test debugging. The singleton server ensures consistent state across test suites while `cleanupTestServer()` provides proper teardown for test isolation.
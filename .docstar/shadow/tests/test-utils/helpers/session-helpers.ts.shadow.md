# tests/test-utils/helpers/session-helpers.ts
@source-hash: 8ca72707a0900e14
@generated: 2026-02-09T18:14:36Z

## tests/test-utils/helpers/session-helpers.ts

**Primary Purpose:** Test utilities providing a simplified interface for debug session operations via a singleton DebugMcpServer instance. Centralizes debug server access and provides logging for integration tests.

**Key Components:**

- **Singleton Server Management (L9-21):** Lazy-initialized `debugServer` variable with `getDebugServer()` factory function creating DebugMcpServer with debug logging enabled
- **Server Lifecycle:** `cleanupTestServer()` (L24-36) handles server shutdown and null cleanup for test teardown
- **Session Management:** `createDebugSession()` (L39-42) creates debug sessions with language-specific parameters
- **Debug Control Flow:** Execution control helpers:
  - `startDebugging()` (L45-54) - launches debug process with optional dry-run support
  - `continueExecution()` (L87-90) - resumes execution
  - `stepOver/Into/Out()` (L93-108) - stepping operations
  - `closeDebugSession()` (L57-60) - session cleanup
- **Debug State Inspection:** Runtime state helpers:
  - `setBreakpoint()` (L63-66) - sets conditional/unconditional breakpoints
  - `getVariables()` (L69-72) - retrieves variables for given scope
  - `getStackTrace()` (L75-78) - gets current stack frames
  - `getScopes()` (L81-84) - retrieves available scopes for frame

**Dependencies:**
- `DebugMcpServer` from main server implementation
- Shared types from `@debugmcp/shared` package
- VSCode Debug Adapter Protocol types for DAP integration

**Architecture Pattern:**
- Singleton pattern for server instance to ensure test consistency
- Wrapper functions with consistent logging for all debug operations
- Explicit cleanup pattern for test teardown scenarios

**Critical Invariants:**
- Server instance persists across test calls until explicit cleanup
- All operations proxy through the singleton server instance
- Comprehensive logging for debugging test failures
# tests/core/unit/server/server-session-tools.test.ts
@source-hash: 964810d99aea4414
@generated: 2026-02-10T00:41:19Z

This file contains comprehensive unit tests for the debug session management tools in the DebugMCP server. It focuses on testing the three core session-related MCP tools: `create_debug_session`, `list_debug_sessions`, and `close_debug_session`.

## Test Structure & Setup

**Test Suite Setup (L26-52):**
- Uses Vitest testing framework with extensive mocking
- Mocks core dependencies: `@modelcontextprotocol/sdk`, `SessionManager`, and dependency injection
- Sets up fresh mock instances in `beforeEach` for each test
- Creates `DebugMcpServer` instance and extracts `callToolHandler` from tool handlers

**Mock Infrastructure:**
- Leverages helper functions from `./server-test-helpers.js` for consistent mock creation
- Mocks production dependencies and replaces them with test doubles
- Configures mock session manager with adapter registry integration

## Tool Test Coverage

### create_debug_session Tool Tests (L54-157)

**Success Path (L55-89):**
- Tests successful session creation with valid Python configuration
- Validates proper call to `SessionManager.createSession` with correct parameters
- Verifies response structure includes `success: true`, `sessionId`, and descriptive message

**Error Handling:**
- **Invalid Language (L91-111):** Tests rejection of unsupported languages (e.g., 'java') with proper McpError
- **SessionManager Errors (L113-130):** Tests error propagation and logging when session creation fails
- **Default Name Generation (L132-156):** Tests automatic generation of session names following pattern `{language}-debug-{timestamp}`

### list_debug_sessions Tool Tests (L159-208)

**Success Path (L160-193):**
- Tests retrieval of multiple sessions with different states ('running', 'stopped')
- Validates response includes session count and full session details array

**Error Handling (L195-207):**
- Tests error propagation when `SessionManager.getAllSessions` throws exceptions

### close_debug_session Tool Tests (L210-254)

**Success Path (L211-225):**
- Tests successful session closure with `SessionManager.closeSession` returning `true`

**Error Scenarios:**
- **Session Not Found (L227-241):** Tests handling when target session doesn't exist (returns `false`)
- **SessionManager Errors (L243-253):** Tests error propagation for closure failures

## Key Dependencies & Relationships

- **DebugMcpServer:** Main server class being tested for tool functionality
- **SessionManager:** Core dependency for all session operations, heavily mocked
- **MCP SDK:** Server framework and transport layer, mocked to isolate business logic
- **Shared Types:** Uses `@debugmcp/shared` types for session info, languages, and states

## Testing Patterns

- **Tool Handler Testing:** Calls tools via `callToolHandler` with MCP protocol structure
- **Mock Verification:** Extensive use of `expect().toHaveBeenCalledWith()` for dependency interaction validation
- **JSON Response Parsing:** All tool responses parsed from `result.content[0].text` for assertion
- **Error Testing:** Uses `rejects.toThrow()` pattern for exception validation with specific error messages
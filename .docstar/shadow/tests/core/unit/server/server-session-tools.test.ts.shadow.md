# tests/core/unit/server/server-session-tools.test.ts
@source-hash: 964810d99aea4414
@generated: 2026-02-09T18:14:19Z

## Purpose
Test suite for DebugMCP server's session management tools (create_debug_session, list_debug_sessions, close_debug_session). Validates tool handlers' parameter validation, error handling, and integration with SessionManager.

## Test Structure
- **Setup/Teardown** (L33-52): Configures comprehensive mock environment with DebugMcpServer, SessionManager, and MCP SDK components. Extracts callToolHandler from server for tool invocation testing.
- **Main Test Groups**: Three tool handlers tested with success paths and error conditions

## Key Test Scenarios

### create_debug_session Tool Tests (L54-157)
- **Valid Session Creation** (L55-89): Tests successful session creation with python language, validates SessionManager.createSession call and response format
- **Language Validation** (L91-111): Verifies rejection of unsupported languages (java) with proper McpError
- **Error Handling** (L113-130): Tests SessionManager creation failures with error logging verification
- **Default Naming** (L132-156): Validates auto-generated session names when none provided (pattern: `python-debug-\d+`)

### list_debug_sessions Tool Tests (L159-208)
- **Successful Listing** (L160-193): Tests retrieval of multiple sessions with proper count and structure
- **Error Handling** (L195-207): Tests SessionManager.getAllSessions failures

### close_debug_session Tool Tests (L210-254)
- **Successful Closure** (L211-225): Tests SessionManager.closeSession returning true
- **Session Not Found** (L227-241): Tests SessionManager.closeSession returning false with appropriate response
- **Error Handling** (L243-253): Tests SessionManager closure exceptions

## Dependencies & Mocking
- **MCP SDK Mocks** (L21-22): Server and StdioServerTransport
- **Core Mocks** (L23-24): SessionManager and dependency container
- **Test Helpers** (L12-18): Comprehensive mock factory functions from server-test-helpers.js

## Architecture Notes
- Uses Vitest testing framework with comprehensive mocking strategy
- Tests tool handler behavior through extracted callToolHandler function
- Validates both success and error paths for each tool
- Ensures proper error propagation and logging integration
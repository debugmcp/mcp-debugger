# tests/core/unit/server/server-inspection-tools.test.ts
@source-hash: 913ec9f1d88a7f1b
@generated: 2026-02-09T18:14:25Z

## Primary Purpose

Test suite for server inspection tools in an MCP (Model Context Protocol) debug server, specifically testing variable inspection, stack trace retrieval, and scope inspection functionality.

## Test Structure

The main test suite (L25-366) is organized into three primary tool testing sections:
- `get_variables` tests (L68-180) - Variable inspection functionality
- `get_stack_trace` tests (L182-300) - Stack trace retrieval
- `get_scopes` tests (L302-365) - Scope inspection

## Key Test Setup

**Setup/Teardown (L32-66):**
- Uses Vitest fake timers to prevent real timeouts (L34)
- Creates comprehensive mocks: dependencies, server, session manager, stdio transport
- Initializes `DebugMcpServer` instance and extracts `callToolHandler` (L48-49)
- Cleanup includes timer management and session cleanup with error handling (L52-66)

**Mock Dependencies (L19-23):**
- Mocks MCP SDK components, session manager, and dependency container
- Uses helper functions from `server-test-helpers.js` for consistent mock creation

## Tool Testing Patterns

**get_variables Tool:**
- Success case validates variable retrieval with scope parameter (L69-100)
- Parameter validation for required `scope` parameter using MCP error codes (L102-123)
- Type validation for scope parameter (L125-144)
- Error handling for session not found scenarios (L146-179)

**get_stack_trace Tool:**
- Success case mocks session with proxy manager and thread ID (L183-208)
- Comprehensive error handling: missing session, missing proxy manager, missing thread ID (L210-280)
- Tests SessionManager error propagation (L282-299)

**get_scopes Tool:**
- Basic success case with frame ID parameter (L303-329)
- Session validation and error handling (L331-364)

## Key Architectural Decisions

**Error Handling Strategy:**
- Tests expect graceful error responses rather than thrown exceptions
- Error responses wrapped in success/error JSON format
- MCP error codes used for parameter validation (McpErrorCode.InvalidParams)

**Session Lifecycle Management:**
- Tests validate session state and lifecycle ('ACTIVE' vs terminated)
- Proxy manager presence and thread ID availability checked before operations
- Consistent session cleanup in teardown

**Mock Strategy:**
- Comprehensive mocking of all external dependencies
- Helper functions provide consistent mock creation
- Tests isolated through proper mock clearing

## Critical Test Invariants

- All tool responses return JSON with success/error structure
- Parameter validation occurs before SessionManager interaction
- Session existence validated before operations
- Proxy manager and thread ID availability checked for stack operations
- Error messages contain descriptive information for debugging
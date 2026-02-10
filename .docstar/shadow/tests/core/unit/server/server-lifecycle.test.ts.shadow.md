# tests/core/unit/server/server-lifecycle.test.ts
@source-hash: 22b7663f7df9535c
@generated: 2026-02-09T18:14:23Z

## Purpose
Unit test suite for `DebugMcpServer` lifecycle operations (start/stop) using Vitest framework. Tests server initialization, startup, and shutdown behaviors with comprehensive mocking of external dependencies.

## Test Structure
- **Main Test Suite** (L23-102): "Server Lifecycle Tests" covering start/stop operations
- **Setup/Teardown** (L29-45): Mock initialization in `beforeEach`, cleanup in `afterEach`
- **Server Start Tests** (L47-65): Validates server startup with stdio transport
- **Server Stop Tests** (L67-102): Validates server shutdown and session cleanup

## Key Dependencies & Mocks
- **External SDK Mocks** (L18-19): `@modelcontextprotocol/sdk` server and stdio transport
- **Internal Component Mocks** (L20-21): `SessionManager` and dependency container
- **Test Helpers** (L10-15): Mock factory functions from `server-test-helpers.js`

## Mock Objects
- **mockDependencies** (L30): Production dependencies mock via `createMockDependencies()`
- **mockServer** (L33): MCP Server instance mock via `createMockServer()`
- **mockSessionManager** (L39): Session management mock with adapter registry
- **mockStdioTransport** (L36): Transport layer mock for stdio communication

## Test Scenarios
- **Basic Start** (L48-55): Verifies successful server startup with logging
- **Start Error Handling** (L57-64): Tests error scenarios during startup
- **Clean Stop** (L68-76): Validates proper shutdown with session cleanup
- **Stop with Session Errors** (L78-90): Tests error handling during session closure
- **Stop with Server Errors** (L92-101): Tests error handling during server closure

## Key Behaviors Tested
- Server initialization with mocked dependencies
- Stdio transport configuration
- Session manager integration during shutdown
- Error propagation and logging during lifecycle operations
- Proper cleanup of resources and sessions
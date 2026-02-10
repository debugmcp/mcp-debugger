# tests/core/unit/server/server-test-helpers.ts
@source-hash: d9b4a6fbcdee726f
@generated: 2026-02-10T00:41:13Z

## Purpose
Test utilities module providing comprehensive mock implementations for server-side testing in a debugging/development server application. Centralizes mock creation for all major server dependencies.

## Core Functions

### `createMockDependencies()` (L8-73)
Primary factory function returning a complete mock dependency injection container. Creates mocked versions of:
- **Logger**: Via external helper (L9-13)
- **File System**: Comprehensive fs-extra-style API with 15+ methods (L14-30)
- **Process/Network Managers**: Simple vi.fn() mocks for process and network handling (L31-36)  
- **Environment**: Process environment wrapper with get/getAll/getCurrentWorkingDirectory (L38-42)
- **Path Utils**: Cross-platform path manipulation utilities with Windows/Unix support (L43-70)
- **Adapter Registry**: External mock for plugin/adapter system (L71)

Key implementation details:
- File system mocks default to optimistic responses (files exist, operations succeed)
- Path utilities include platform-aware absolute path detection (L44-51)
- Simple path manipulation with forward-slash normalization (L52-69)

### `createMockServer()` (L75-82)
Creates mock server instance with core MCP (Model Context Protocol) server methods:
- Request handler registration, connection lifecycle, error handling

### `createMockSessionManager(mockAdapterRegistry)` (L84-104)
Comprehensive debugging session manager mock with:
- Session lifecycle (create/get/close operations)
- Debugging controls (breakpoints, stepping, continue)
- Runtime inspection (variables, stack traces, scopes, expression evaluation)
- Adapter registry integration

### `createMockStdioTransport()` (L106-108)
Minimal transport mock - currently returns empty object (likely placeholder)

### `getToolHandlers(mockServer)` (L110-116)
Test utility to extract registered request handlers from mock server, specifically:
- List tools handler (first registered handler)
- Call tool handler (second registered handler)

## Dependencies
- **vitest**: Mock function creation (`vi.fn()`)
- **External test utilities**: Logger and adapter registry mocks from test-utils

## Architecture Notes
- Follows dependency injection pattern with centralized mock factory
- Designed for MCP server testing with debugging capabilities
- File system mocking assumes fs-extra-style async/sync API duality
- Path utilities maintain cross-platform compatibility in test environment
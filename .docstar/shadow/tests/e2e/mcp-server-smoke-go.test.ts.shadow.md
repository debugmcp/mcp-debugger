# tests/e2e/mcp-server-smoke-go.test.ts
@source-hash: ee36166d2448fae7
@generated: 2026-02-10T21:25:35Z

## Primary Purpose
End-to-end smoke test for Go debugging functionality through MCP (Model Context Protocol) interface. Tests the complete integration chain from adapter registration to actual debugging operations using Delve.

## Key Test Structure
- **Main test suite** (L26-254): `'MCP Server Go Debugging Smoke Test @requires-go'` - comprehensive Go adapter validation
- **Setup/teardown** (L31-87): MCP client lifecycle management with proper session cleanup
- **Test fixtures** (L27-29): Client state management with `mcpClient`, `transport`, and `sessionId`

## Core Test Cases
1. **Adapter Registration Test** (L89-107): Validates Go adapter can be loaded through AdapterLoader with `language: 'go'` parameter
2. **Adapter Listing Test** (L109-132): Optional verification that Go adapter appears in available adapters list
3. **Complete Debugging Flow Test** (L134-253): Full integration test including compilation, breakpoints, and execution

## Key Dependencies
- **MCP SDK** (L18-19): `@modelcontextprotocol/sdk` for client/transport communication
- **Vitest framework** (L15): Testing infrastructure with async setup/teardown
- **External tools**: Requires Go compiler and Delve debugger for full flow test
- **Smoke test utilities** (L20): `parseSdkToolResult` and `callToolSafely` helpers

## Critical Integration Points
- **MCP Server startup** (L35-42): Spawns server process via `dist/index.js` with stdio transport
- **Session lifecycle** (L58-86): Proper cleanup in both `afterAll` and `afterEach` hooks
- **Binary compilation** (L164-168): Compiles test Go program with debug symbols (`-gcflags="all=-N -l"`)

## Test Flow Architecture
1. **Environment validation** (L140-157): Checks for Go/Delve availability before attempting full flow
2. **MCP tool calls** (L92-98, L177-221): Direct invocation of debug session tools through MCP interface
3. **Timing coordination** (L224, L240): Strategic delays for debugging operations to complete

## Notable Patterns
- **Graceful degradation**: Tests skip gracefully if Go/Delve not installed rather than failing
- **Resource cleanup**: Comprehensive cleanup of sessions, connections, and temporary binaries
- **Error tolerance**: Uses `callToolSafely` wrapper for operations that may legitimately fail

## Test Validation Points
- Adapter registration through `AdapterLoader.loadAdapter('go')` 
- MCP tool integration (`create_debug_session`, `set_breakpoint`, `start_debugging`)
- Delve integration for stack traces and execution control
- Binary execution mode with pre-compiled Go programs
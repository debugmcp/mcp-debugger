# tests/core/unit/server/dynamic-tool-documentation.test.ts
@source-hash: 86be00225deb9e7e
@generated: 2026-02-10T00:41:10Z

## Purpose
Test file for dynamic tool documentation in the DebugMcpServer, specifically focusing on path-related parameter descriptions and MCP response serialization.

## Key Test Suites

### Main Test Structure (L111-288)
- **Dynamic Tool Documentation** - Top-level describe block containing all test scenarios
- **Hands-off Path Approach** (L117-238) - Tests generic path guidance without specific directory references
- **MCP Response Serialization** (L240-287) - Tests proper serialization of tool descriptions in MCP responses

## Key Functions

### getToolsFromServer (L60-109)
Helper function that extracts tools from a DebugMcpServer instance by:
- Spying on `setRequestHandler` to capture the tools list handler (L74-83)
- Re-registering tools via private `registerTools()` method (L86)
- Invoking the captured handler to retrieve tools array (L94-95)
- Returns typed tool definitions with name, description, and inputSchema

## Test Dependencies & Mocks

### Mock Setup (L6-54)
- **createProductionDependencies** (L7-34) - Mocks all external dependencies (logger, fileSystem, environment, etc.)
- **SessionManager** (L38-53) - Mocks all debugging session management methods
- **ListToolsRequestSchema** (L57) - Imported from MCP SDK for schema validation

### Test Fixtures (L118-138, L241-260)
Mock implementations for:
- `IEnvironment` with `getCurrentWorkingDirectory()` returning `process.cwd()`
- `IFileSystem` with `existsSync()` returning true
- `ILogger` with standard logging methods
- Fresh `DebugMcpServer` instance per test

## Test Scenarios

### Path Documentation Tests (L140-237)
Validates that tool descriptions provide:
- **Generic path guidance** for `set_breakpoint.file`, `start_debugging.scriptPath`, `get_source_context.file`
- **Consistent terminology** - "source file" vs "script" appropriately
- **No specific directory paths** - excludes Windows (`C:\`), Unix (`/home/`), container (`/workspace`) paths
- **Simple guidance** emphasizing "relative to your current working directory"

### Serialization Tests (L262-286)
Ensures MCP response structure contains:
- Valid array of tools
- String descriptions with content
- Proper typing for path-related properties

## Architecture Notes
- Uses Vitest testing framework with comprehensive mocking
- Tests internal behavior by accessing private `registerTools()` method via type casting
- Focuses on documentation consistency rather than functionality
- Emphasizes environment-agnostic path descriptions for better AI agent consumption

## Dependencies
- `../../../../src/server.js` - DebugMcpServer class
- `../../../../src/interfaces/external-dependencies.js` - Type definitions
- `@modelcontextprotocol/sdk/types.js` - MCP protocol schemas
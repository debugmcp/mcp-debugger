# tests/core/unit/server/server-language-discovery.test.ts
@source-hash: 1000a6dadd9a032f
@generated: 2026-02-10T00:41:21Z

## Purpose
Comprehensive test suite validating server-side language discovery functionality in the DebugMCP system. Tests dynamic language detection, metadata generation, adapter registry integration, and error handling scenarios.

## Key Test Structure
- **Main Test Suite** (L27): Tests `Server Language Discovery Tests` with full mock setup and teardown
- **Mock Setup** (L34-58): Configures comprehensive mocks including `DebugMcpServer`, SDK `Server`, `SessionManager`, and `AdapterRegistry`
- **Test Helper Integration** (L13-19): Uses shared test utilities from `server-test-helpers.js`

## Test Categories

### JavaScript Language Discovery (L64-101)
- **JavaScript Metadata Test** (L65): Validates JavaScript adapter detection with rich metadata including `defaultExecutable: 'node'`
- Tests dynamic registry reporting and installed package detection

### Dynamic Language Discovery (L103-233) 
- **Primary Discovery Test** (L104): Tests `getSupportedLanguagesAsync` with mock registry returning `['python', 'mock']`
- **Fallback Mechanism** (L132): Tests graceful fallback when dynamic discovery fails
- **Null Registry Handling** (L156): Tests behavior with undefined adapter registry
- **Empty Lists** (L178): Tests handling of empty language lists from registry
- **Container Environment** (L203): Tests Python advertising when `MCP_CONTAINER=true`

### Language Metadata Generation (L235-290)
- **Metadata Structure** (L236): Tests metadata generation for discovered languages
- **Unknown Language Handling** (L257): Tests graceful handling of unknown languages with default metadata

### Session Creation Validation (L292-364)
- **Language Validation** (L293): Tests `create_debug_session` validates supported languages before creation
- **Unsupported Language Rejection** (L325): Tests error handling for unsupported languages
- **Validation Error Handling** (L344): Tests graceful handling of language validation failures

### Debugging Session Validation (L366-428)
- **Pre-Start Validation** (L376): Tests language support validation before `start_debugging`
- **Dynamic Discovery Integration** (L399): Tests dynamic language discovery for session languages

### Error Handling Edge Cases (L430-479)
- **Missing Methods** (L431): Tests graceful handling of incomplete registry implementations
- **Method Exceptions** (L456): Tests handling of registry method exceptions with fallback behavior

## Key Dependencies
- **Vitest Framework** (L6): Testing framework with mocking capabilities
- **MCP SDK** (L7): `@modelcontextprotocol/sdk/server`
- **Core Components** (L8-12): `DebugMcpServer`, `SessionManager`, `AdapterRegistry`
- **Test Utilities** (L14-18): Shared mock creation and tool handler utilities

## Mock Configuration
- **Adapter Registry Mock** (L42-54): Extended mock with all required methods (`listLanguages`, `listAvailableAdapters`, `getSupportedLanguages`)
- **Default Languages** (L44): Mock supports `['python', 'mock']` by default
- **Tool Handler Pattern**: Uses `getToolHandlers(mockServer).callToolHandler` for consistent tool invocation

## Critical Test Patterns
- All tests follow pattern: setup → tool call → JSON response parsing → assertion
- Consistent use of `expect(result.content[0].type).toBe('text')` and `JSON.parse(result.content[0].text)`
- Environment variable restoration pattern for container tests (L227-231)
- Comprehensive error scenario coverage with both sync and async failure modes
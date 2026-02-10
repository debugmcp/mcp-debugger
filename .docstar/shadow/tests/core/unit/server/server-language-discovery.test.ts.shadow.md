# tests/core/unit/server/server-language-discovery.test.ts
@source-hash: 1000a6dadd9a032f
@generated: 2026-02-09T18:14:24Z

## Purpose
Comprehensive test suite for server language discovery functionality in the DebugMCP project. Tests dynamic language discovery, metadata generation, and adapter registry integration through the MCP tool interface.

## Test Structure
- **Main Test Suite** (L27-480): "Server Language Discovery Tests" with setup/teardown for mock dependencies
- **beforeEach Setup** (L34-58): Creates mock dependencies, server, adapter registry, and session manager
- **afterEach Cleanup** (L60-62): Clears all mocks between tests

## Key Test Groups

### JavaScript Availability Tests (L64-101)
- **JavaScript Metadata Test** (L65-100): Verifies JavaScript adapter reports as installed with correct metadata (defaultExecutable: 'node')
- Tests dynamic registry behavior when JavaScript adapter is resolvable

### Dynamic Language Discovery Tests (L103-233)  
- **Dynamic Discovery Success** (L104-130): Tests language discovery from adapter registry when available
- **Fallback Handling** (L132-154): Tests fallback to getSupportedLanguages when dynamic discovery fails
- **Undefined Registry Handling** (L156-176): Tests graceful handling when adapter registry is undefined
- **Empty Lists Handling** (L178-201): Tests behavior with empty language lists from registry
- **Container Environment** (L203-232): Tests Python inclusion when MCP_CONTAINER=true

### Metadata Generation Tests (L235-290)
- **Language Metadata** (L236-255): Tests metadata generation for discovered languages
- **Unknown Language Handling** (L257-289): Tests metadata generation for unknown/unsupported languages

### Session Creation with Validation (L292-364)
- **Language Validation** (L293-323): Tests language support validation before creating debug sessions
- **Unsupported Language Rejection** (L325-342): Tests rejection of unsupported languages
- **Validation Error Handling** (L344-363): Tests graceful handling of language validation errors

### Debug Start with Validation (L366-428)
- **Pre-start Validation** (L376-397): Tests language support validation before starting debugging
- **Dynamic Discovery Integration** (L399-427): Tests dynamic language discovery for session languages

### Edge Cases (L430-479)
- **Missing Registry Methods** (L431-454): Tests handling of incomplete adapter registry interface
- **Registry Method Exceptions** (L456-478): Tests handling of registry method failures

## Key Dependencies
- **DebugMcpServer** (L8): Main server class under test
- **SessionManager** (L9): Session management functionality
- **AdapterRegistry** (L11-12): Language adapter management
- **Mock Dependencies** (L13-19): Test helpers from server-test-helpers.js

## Mock Strategy
- **Mock Adapter Registry** (L42-54): Extended mock with all required methods (getSupportedLanguages, listLanguages, listAvailableAdapters, etc.)
- **Tool Handler Testing**: Uses getToolHandlers to test MCP tool interface
- **Environment Mocking** (L204-231): Tests container environment detection

## Critical Test Patterns
- Tests fallback mechanisms when dynamic discovery fails
- Validates language metadata structure and content
- Tests integration between adapter registry and session management
- Verifies environment-specific behavior (container detection)
- Tests error handling and graceful degradation
# tests/e2e/npx/npx-smoke-javascript.test.ts
@source-hash: 4cfd6747ba75441a
@generated: 2026-02-09T18:14:39Z

## NPX JavaScript Smoke Tests

E2E test suite verifying JavaScript debugging functionality when running via npx (npm package execution). Critical test ensuring the JavaScript adapter is properly included in npx distribution after a packaging fix.

### Core Purpose
Tests the complete JavaScript debugging workflow through npx to verify:
- JavaScript language adapter availability in packaged distribution
- Full debugging cycle (session creation, breakpoints, stepping, variables)
- NPX installation and execution pipeline

### Test Structure
**Sequential Test Suite (L19)**: Uses Vitest with sequential execution to avoid race conditions
- `mcpClient`: MCP client instance for tool calls (L20)
- `cleanup`: Cleanup function from npx utilities (L21)  
- `sessionId`: Active debugging session identifier (L22)
- `tarballPath`: Path to built npm package (L23)

### Setup & Teardown
**beforeAll (L25-65)**: 
- Builds and packs npm package via `buildAndPackNpmPackage()`
- Installs package globally via `installPackageGlobally()`
- Creates MCP client via `createNpxMcpClient()` with debug logging
- Wraps `callTool` with request/response logging (L39-60)

**afterAll (L67-87)**: Closes debug session, runs cleanup, removes global install
**afterEach (L89-101)**: Ensures session cleanup between tests

### Key Dependencies
- `./npx-test-utils.js`: NPX-specific utilities for package building/installation (L11)
- `../smoke-test-utils.js`: `parseSdkToolResult` for response parsing (L12)
- `@modelcontextprotocol/sdk/client`: MCP client types (L13)

### Critical Tests

**Language Support Test (L103-123)**:
- Calls `list_supported_languages` tool
- Verifies JavaScript language with ID 'javascript' is available
- **Critical assertion**: Ensures JavaScript adapter is included in npx distribution (L118-122)

**Full Debugging Cycle Test (L125-272)**:
Complete 8-step workflow testing:
1. Creates debug session for JavaScript (L130-142)
2. Sets breakpoint at line 14 of test script (L146-168)
3. Starts debugging with script path (L172-184)
4. Retrieves variables before execution (L191-211)
5. Steps over one instruction (L215-222)
6. Verifies variable changes after step (L228-244)
7. Continues execution to completion (L248-255)
8. Closes debug session (L261-268)

### Test Configuration
- Extended timeouts: 240s for setup, 120s for debugging cycle
- Uses `examples/javascript/simple_test.js` as test script (L126)
- Validates variable swapping: a=1→2, b=2→1 (L208-209, L241-242)
- Includes debug logging and error handling throughout

### Architectural Notes
- Sequential execution prevents resource conflicts
- Comprehensive logging for debugging test failures  
- Graceful error handling in cleanup operations
- Validates both tool availability and functional debugging workflow
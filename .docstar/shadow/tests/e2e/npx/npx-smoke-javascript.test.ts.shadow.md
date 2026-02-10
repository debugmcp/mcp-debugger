# tests/e2e/npx/npx-smoke-javascript.test.ts
@source-hash: 4cfd6747ba75441a
@generated: 2026-02-10T00:41:33Z

**NPX JavaScript Smoke Tests - E2E Test Suite**

**Primary Purpose**: End-to-end testing of JavaScript debugging functionality when the MCP debug server is run via `npx` package distribution. Specifically validates the critical fix that ensures JavaScript adapter is included in the npm package.

**Key Test Structure**:
- **Main test suite** (L19-273): `describe.sequential('NPX: JavaScript Debugging Smoke Tests')`
- **Setup/teardown lifecycle** (L25-101): Manages global npm package installation and MCP client connection
- **Language availability test** (L103-123): Verifies JavaScript is in supported languages list
- **Full debugging cycle test** (L125-272): Complete JavaScript debugging workflow validation

**Core Dependencies**:
- `vitest` test framework (L8)
- `@modelcontextprotocol/sdk/client` for MCP communication (L13)
- Custom utilities: `buildAndPackNpmPackage`, `installPackageGlobally`, `createNpxMcpClient`, `cleanupGlobalInstall` from `npx-test-utils.js` (L11)
- `parseSdkToolResult` from `smoke-test-utils.js` (L12)

**Test State Management**:
- `mcpClient` (L20): MCP SDK client instance with instrumented `callTool` method (L38-61)
- `sessionId` (L22): Debug session identifier, managed across test lifecycle
- `tarballPath` (L23): Path to built npm package for global installation
- `cleanup` (L21): Cleanup function for MCP client resources

**Critical Test Validations**:

1. **JavaScript Language Support** (L103-123):
   - Calls `list_supported_languages` tool (L104-107)
   - Validates `javascript` language exists with correct metadata (L115-119)
   - **Critical assertion**: `expect(jsLang).toBeDefined()` (L118) - verifies the core fix

2. **Complete Debugging Workflow** (L125-272):
   - Session creation (L130-142): `create_debug_session` with language='javascript'
   - Breakpoint setting (L146-168): `set_breakpoint` at line 14 of test script
   - Debug execution (L172-184): `start_debugging` with script path
   - Variable inspection (L191-211): `get_local_variables` before code execution
   - Code stepping (L215-222): `step_over` to advance execution
   - Variable validation (L228-244): Confirms variable state changes after step
   - Session cleanup (L248-269): `continue_execution` and `close_debug_session`

**Test Infrastructure**:
- **Setup** (L25-65): Builds npm package, installs globally, creates npx-based MCP client
- **Logging instrumentation** (L38-61): Wraps `callTool` with detailed request/response logging
- **Cleanup** (L67-101): Ensures debug sessions are closed and global packages are removed
- **Timeouts**: 240s for setup (L65), 120s for main test (L272)

**Architectural Notes**:
- Uses sequential test execution to avoid npm package conflicts
- Employs global npm installation to simulate real npx usage
- Includes defensive error handling for cleanup operations (L74-76, L96-98)
- Tests actual JavaScript file execution (`examples/javascript/simple_test.js`) rather than mocks
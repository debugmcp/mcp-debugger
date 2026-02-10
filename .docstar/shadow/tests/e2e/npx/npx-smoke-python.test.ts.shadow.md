# tests/e2e/npx/npx-smoke-python.test.ts
@source-hash: 6097174585d3ed42
@generated: 2026-02-09T18:14:42Z

## Purpose
End-to-end test suite for Python debugging functionality when the MCP debug server is distributed and executed via npx. Validates the complete debugging workflow including session management, breakpoint operations, variable inspection, and execution control in a real npm package distribution environment.

## Test Architecture
**Sequential Test Suite (L18)**: Uses `describe.sequential` to ensure tests run in order, preventing interference between shared global package installation state.

**Global Setup/Teardown (L24-66)**: 
- `beforeAll` (L24-44): Builds npm package, installs globally via tarball, creates MCP client connection
- `afterAll` (L46-66): Cleans up debug sessions, MCP connections, and global npm installations
- `afterEach` (L68-80): Per-test session cleanup to prevent state leakage

## Key Components

**Test State Variables (L19-22)**:
- `mcpClient`: MCP SDK client instance for tool invocations
- `cleanup`: Async cleanup function from MCP client creation
- `sessionId`: Active debug session identifier
- `tarballPath`: Path to built npm package tarball

**Language Support Test (L82-98)**: Validates Python language availability in the npx-distributed server by calling `list_supported_languages` tool and checking for Python language definition.

**Full Debugging Cycle Test (L100-241)**: Comprehensive integration test covering:
1. Debug session creation with Python language
2. Breakpoint setting on line 11 of test script
3. Debug execution start with DAP launch configuration
4. Variable inspection before code execution
5. Step-over execution control
6. Variable validation after step execution (verifies variable swap)
7. Execution continuation
8. Session cleanup

## Dependencies
- **NPX Test Utilities (L10)**: `buildAndPackNpmPackage`, `installPackageGlobally`, `createNpxMcpClient`, `cleanupGlobalInstall`, `getPackageSize`
- **Smoke Test Utilities (L11)**: `parseSdkToolResult` for MCP tool response parsing
- **MCP SDK (L12)**: Client interface for MCP server communication
- **Test Script Path (L101)**: `examples/python/simple_test.py` - Python script with variable swap logic

## Test Patterns
**Extended Timeouts**: 240s for setup (L44), 120s for main test (L241) - accounts for npm package building, global installation, and debugging operations

**Deliberate Wait Periods**: Strategic delays (L156, L193, L226) to allow debug state stabilization between operations

**Error Resilience**: Try-catch blocks in cleanup operations (L48-55, L69-77) to handle already-closed sessions gracefully

**State Validation**: Each debugging operation validates both success status and expected state changes (variables, execution state)

## Critical Test Data
The test expects specific variable behavior in the Python test script:
- Initial state: `a=1, b=2` (L177-178)
- After step-over: `a=2, b=1` (L210-211)

This validates that the debugger correctly steps through variable swap logic and variable inspection works properly.
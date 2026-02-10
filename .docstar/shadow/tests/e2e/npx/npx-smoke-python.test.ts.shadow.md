# tests/e2e/npx/npx-smoke-python.test.ts
@source-hash: 6097174585d3ed42
@generated: 2026-02-10T00:41:33Z

## Purpose
End-to-end smoke test suite for Python debugging functionality when using the MCP debugger via `npx` (globally installed package). Validates complete debugging workflow including session management, breakpoints, variable inspection, and execution control.

## Test Setup & Configuration
- **Test Framework**: Vitest with sequential execution (L7, L18)
- **Package Preparation**: Builds, packs, and globally installs npm package before tests (L24-44)
- **Client Setup**: Creates NPX-based MCP client with debug logging (L36-43)
- **Timeout Configuration**: 240s for setup, 120s for main test (L44, L241)

## Key Test State Variables
- `mcpClient`: MCP SDK client instance (L19)
- `cleanup`: Cleanup function for process/connection teardown (L20)
- `sessionId`: Active debug session identifier (L21)
- `tarballPath`: Path to built npm package (L22)

## Test Structure
### Setup Phase (L24-44)
1. Builds and packs npm package using `buildAndPackNpmPackage()`
2. Logs package size metrics
3. Installs package globally via `installPackageGlobally()`
4. Creates NPX MCP client connection

### Cleanup Phase (L46-66, L68-80)
- **afterAll**: Closes debug session, runs cleanup, removes global install
- **afterEach**: Closes active debug session and resets sessionId

## Core Test Cases

### Language Support Test (L82-98)
- Calls `list_supported_languages` tool
- Validates Python language is available in supported languages array
- Verifies response structure and success status

### Complete Debugging Workflow Test (L100-241)
**Test Script**: `examples/python/simple_test.py` - variable swap operation (L101)

**8-Step Debugging Sequence**:
1. **Session Creation** (L104-117): Creates named debug session for Python
2. **Breakpoint Setting** (L119-133): Sets breakpoint at line 11 of test script
3. **Debug Start** (L135-153): Launches debugging with DAP configuration
4. **Pre-execution Variables** (L158-180): Inspects variables before swap (a=1, b=2)
5. **Step Over** (L182-191): Executes single step over breakpoint
6. **Post-execution Variables** (L195-213): Verifies variable swap (a=2, b=1)
7. **Continue Execution** (L215-224): Resumes program execution
8. **Session Cleanup** (L228-238): Closes debug session

## Dependencies
- **Test Utilities**: `./npx-test-utils.js` for NPX package management (L10)
- **Smoke Test Utils**: `../smoke-test-utils.js` for result parsing (L11)
- **MCP SDK**: Client interface for tool communication (L12)

## Architectural Patterns
- **Sequential Test Execution**: Prevents race conditions in global package installation
- **Comprehensive Cleanup**: Multiple cleanup layers (afterEach, afterAll) ensure no leaked resources
- **Stabilization Delays**: Strategic timeouts (1-2s) allow debug state transitions to complete
- **Error Resilience**: Try-catch blocks in cleanup prevent cascade failures

## Critical Constraints
- **Global Installation Required**: Tests npm package distribution mechanism
- **File System Dependencies**: Relies on specific example Python script location
- **Debug State Management**: Careful session lifecycle to prevent resource leaks
- **Timing Dependencies**: Synchronization delays for debug adapter protocol operations
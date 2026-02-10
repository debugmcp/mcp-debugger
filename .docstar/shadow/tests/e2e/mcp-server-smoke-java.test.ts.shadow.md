# tests/e2e/mcp-server-smoke-java.test.ts
@source-hash: d798c7e885f25277
@generated: 2026-02-09T18:15:13Z

## Primary Purpose
End-to-end smoke tests for Java debugging functionality through MCP (Model Context Protocol) interface using jdb (Java Debugger). Tests critical debugging operations including breakpoints, stepping, variable inspection, and stack traces.

## Key Functions & Classes

### `ensureCompiled(javaFile: string)` (L31-60)
Utility function that checks for compiled .class files and automatically compiles .java sources using javac if needed. Returns Promise<void>.

### Test Suite Structure (L62-477)
Main describe block with setup/teardown hooks and 6 comprehensive test cases:

- **beforeAll** (L67-98): Compiles test Java file, starts MCP server via StdioClientTransport, creates and connects MCP client with 30s timeout
- **afterAll** (L100-119): Cleanup session, closes client and transport
- **afterEach** (L121-131): Per-test session cleanup

## Core Test Cases

### `should complete Java debugging flow cleanly` (L133-283)
Complete debugging workflow test covering:
- Session creation with language='java' 
- Breakpoint setting at line 48 (factorial call)
- Debug start with scriptPath and dapLaunchArgs
- Stack trace retrieval and frame validation
- Scopes/variables inspection (expects 'Locals' scope)
- Step over operation with tolerant success checking
- Continue execution and session closure

### `should handle multiple breakpoints in Java` (L285-322)
Tests setting multiple breakpoints at lines 48 and 69, validates both are accepted.

### `should evaluate expressions in Java context` (L324-374)  
Tests expression evaluation ('1 + 2') with stopOnEntry=true launch configuration.

### `should get source context for Java files` (L376-410)
Tests source context retrieval around line 48 with 5 lines of context, validates 'factorial' content presence.

### `should handle step into for Java` (L412-476)
Tests step_into operation from factorial call, validates increased stack depth indicating function entry.

## Dependencies & Configuration
- **MCP SDK**: Client, StdioClientTransport for protocol communication
- **Test Framework**: Vitest with describe/it/expect/hooks
- **Target**: `examples/java/TestJavaDebug.java` (requires absolute paths)  
- **Server**: Starts `dist/index.js` with info logging in test environment
- **Timeouts**: 30s setup, 60s main test, various operation delays (2-4s)

## Architecture Notes
- Uses jdb as underlying debug engine (requires compiled .class files)
- All Java file references must use absolute paths
- Stack traces include Java internal frames  
- Implements tolerant success checking (accepts success=true OR message defined)
- Comprehensive error handling with session cleanup in hooks
- Uses `callToolSafely` wrapper for MCP tool invocations
# tests/e2e/mcp-server-smoke-java.test.ts
@source-hash: 7c021c233c66b47e
@generated: 2026-02-10T21:25:52Z

**Primary Purpose**: End-to-end smoke tests for Java debugging functionality through MCP (Model Context Protocol) interface using jdb as the underlying debug engine.

**Key Functions and Classes**:

- `ensureCompiled(javaFile: string)` (L31-60): Utility function that checks for compiled .class files and auto-compiles Java source files using javac if needed. Uses Promise-based spawn for compilation.

- Main test suite `"MCP Server Java Debugging Smoke Test"` (L62-477): Comprehensive integration tests covering full Java debugging workflow through MCP tools.

**Test Structure**:
- `beforeAll` (L67-98): Sets up MCP client connection, compiles test Java file, configures stdio transport with 30s timeout
- `afterAll` (L100-119): Cleanup including session closure and transport termination  
- `afterEach` (L121-131): Per-test session cleanup to prevent state leakage

**Core Test Cases**:

1. `"should complete Java debugging flow cleanly"` (L133-283): Primary integration test covering:
   - Session creation with Java language adapter
   - Breakpoint setting at line 48 (factorial call)
   - Debug execution start with configurable launch args
   - Stack trace inspection with frame validation
   - Variable scope enumeration and inspection
   - Step over operation with location/context verification
   - Execution continuation and session cleanup

2. `"should handle multiple breakpoints in Java"` (L285-322): Tests concurrent breakpoint management at lines 48 and 69

3. `"should evaluate expressions in Java context"` (L324-374): Expression evaluation testing with stopOnEntry mode, validates arithmetic expressions

4. `"should get source context for Java files"` (L376-410): Source code retrieval with configurable line context window

5. `"should handle step into for Java"` (L412-476): Step-into debugging with stack depth validation for function entry

**Key Dependencies**:
- MCP SDK client components for protocol communication
- Vitest testing framework with async/await patterns
- Node.js child_process for Java compilation
- Custom utilities: `parseSdkToolResult`, `callToolSafely` from smoke-test-utils

**Critical Architecture Notes**:
- Requires absolute paths for Java file references (jdb limitation)
- Auto-compilation workflow checks for .class files before .java compilation
- Tolerant error handling for debugging operations (accepts partial success states)
- 60-second test timeouts for long-running debug operations
- Uses TestJavaDebug.java as the target debugging artifact

**Important Constraints**:
- Java debugger integration depends on jdb availability
- Compiled bytecode required for debugging (not source-only)
- Stack traces include Java internal frames (expected behavior)
- Session state must be properly cleaned up to prevent interference between tests
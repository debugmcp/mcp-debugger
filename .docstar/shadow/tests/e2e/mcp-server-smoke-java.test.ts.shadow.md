# tests/e2e/mcp-server-smoke-java.test.ts
@source-hash: d798c7e885f25277
@generated: 2026-02-10T00:42:07Z

## Primary Purpose
End-to-end smoke tests for Java debugging functionality via MCP (Model Context Protocol) interface. Tests the complete Java debugging workflow using jdb as the underlying debug engine through MCP tools.

## Key Functions and Components

### Setup and Compilation
- `ensureCompiled(javaFile)` (L31-60): Checks for existing .class files and compiles .java sources using javac if needed. Handles compilation errors gracefully.

### Test Infrastructure
- **beforeAll** (L67-98): Initializes MCP client, connects to debug server, and ensures test Java file is compiled. Sets 30s timeout for setup.
- **afterAll** (L100-119): Cleanup routine that closes debug sessions, MCP client, and transport connections.
- **afterEach** (L121-131): Per-test cleanup to ensure debug sessions are properly closed.

### Core Test Cases

#### Complete Debugging Flow (L133-283)
- Creates Java debug session for `examples/java/TestJavaDebug.java`
- Sets breakpoint at line 48 (factorial call)
- Starts debugging with absolute file paths (Java requirement)
- Validates stack traces, scopes, and variables
- Tests step_over operation with tolerant success checking
- Continues execution and closes session cleanly
- 60s timeout for complete workflow

#### Multiple Breakpoints Test (L285-322)
- Tests setting multiple breakpoints in the same Java file
- Validates breakpoint acceptance without requiring verification

#### Expression Evaluation Test (L324-374)
- Tests runtime expression evaluation (`1 + 2`)
- Uses `stopOnEntry: true` to pause immediately
- Validates evaluation results contain expected values

#### Source Context Test (L376-410)
- Tests retrieval of source code context around specific lines
- Validates source content includes expected method names

#### Step Into Test (L412-476)
- Tests stepping into method calls (factorial function)
- Validates increased stack depth after step operation
- Uses tolerant success checking for debugging operations

## Key Dependencies
- **Vitest** (L12): Test framework
- **@modelcontextprotocol/sdk** (L15-16): MCP client and transport
- **smoke-test-utils** (L17): Utilities for tool result parsing and safe tool calls
- **Node.js modules**: path, url, child_process, fs for file operations and process spawning

## Architecture and Patterns

### Java-Specific Characteristics
- Requires absolute paths for file references (noted in comments L4-10)
- Auto-compiles .java to .class files if needed
- Uses jdb (Java Debugger) as underlying engine
- Stack traces include Java internal frames

### Error Handling Strategy
- Tolerant testing approach: accepts partial success for debugging operations
- Graceful handling of compilation failures
- Safe cleanup in all teardown phases
- Uses `callToolSafely()` utility for MCP tool calls

### Test Structure
- Each test creates isolated debug sessions
- Consistent session lifecycle: create → configure → execute → cleanup
- 4-second waits for breakpoint hits, 2-second waits for step operations
- Uses `sessionId` tracking for proper cleanup

## Critical Constraints
- Java files must be compiled to .class files before debugging
- Absolute file paths required for Java debugging
- Tests depend on `examples/java/TestJavaDebug.java` existing
- MCP server must be built and available at `dist/index.js`
- Requires javac compiler in system PATH
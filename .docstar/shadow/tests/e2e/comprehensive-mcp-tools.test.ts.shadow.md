# tests/e2e/comprehensive-mcp-tools.test.ts
@source-hash: abcd3ac3e7f3b630
@generated: 2026-02-10T21:25:43Z

## Comprehensive E2E MCP Debugger Test Suite

**Purpose**: End-to-end integration test that validates all 19 MCP debugger tools across 6 programming languages (Python, JavaScript, Rust, Go, Java, Mock). Generates a detailed PASS/FAIL matrix report for comprehensive debugging server validation.

### Core Architecture

**Test Framework**: Vitest-based test suite with MCP client integration
- **MCP Client Setup** (L127-145): Establishes StdioClientTransport connection to debugger server
- **Result Tracking System** (L25-41): Records test outcomes with status, timing, and detailed messages
- **Language Detection** (L60-90): Runtime toolchain availability checking for Rust/Go/Java

### Key Types & Interfaces

- **ToolResult** (L27-33): Test result record with tool, language, status, detail, duration
- **LangDef** (L75-81): Language definition with script paths, breakpoint lines, availability
- **ToolStatus** (L25): Union type for test outcomes ('PASS' | 'FAIL' | 'SKIP' | 'PENDING')

### Language Configuration

**Supported Languages** (L83-90): 6 language adapters with example scripts
- Python: `examples/python/simple_test.py` (BP line 8)
- JavaScript: `examples/javascript/simple_test.js` (BP line 9)  
- Mock: Uses Python script for testing (BP line 8)
- Rust: `examples/rust/hello_world/src/main.rs` (BP line 13) - conditional
- Go: `examples/go/hello_world.go` (BP line 12) - conditional
- Java: `examples/java/TestJavaDebug.java` (BP line 44) - conditional

### Test Tool Coverage

**All 19 MCP Tools** (L94-114): Complete debugger API validation
- Session management: create, list, close
- Breakpoint operations: set_breakpoint, get_source_context
- Debug execution: start, step_over/into/out, continue, pause
- Inspection: get_stack_trace, get_scopes, get_variables, get_local_variables, evaluate_expression
- Process attachment: attach_to_process, detach_from_process

### Test Execution Patterns

**Language-Agnostic Tests** (L169-201): Tools 1 & 3 (list operations) tested once across all languages

**Per-Language Test Suites** (L207-674): Individual language validation with two workflows:
1. **Real Language Full Workflow** (L316-507): Complete debug session lifecycle with breakpoint hitting, inspection, stepping, and cleanup
2. **Mock Adapter Lifecycle** (L510-579): Simplified session testing without real debugging

**Session State Management** (L122-163): Automatic cleanup in afterEach, proper session lifecycle management

### Error Handling & Expectations

**Graceful Failure Handling**: Expected failures for unimplemented features (pause_execution), connection errors (attach_to_process), and mock limitations are treated as PASS results

**Timeout Configuration**: Generous timeouts (15-90 seconds) for different operation complexities

### Reporting & Output

**Matrix Report Generation** (L678-721): 
- Console matrix display with visual status indicators (✓/✗/⊘)
- JSON report export to `comprehensive-test-results.json`
- Summary statistics (total/pass/fail/skip counts)

**Real-time Progress Logging** (L37-41): Live test result streaming with timing information

### Dependencies

- **MCP SDK**: Client and transport layers for server communication
- **Utility Functions** (L17): `parseSdkToolResult`, `callToolSafely` from smoke test utils
- **Node.js Core**: Path, URL, child_process for toolchain detection and file operations
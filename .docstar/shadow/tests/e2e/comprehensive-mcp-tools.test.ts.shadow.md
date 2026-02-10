# tests/e2e/comprehensive-mcp-tools.test.ts
@source-hash: a192b3ea8fd078de
@generated: 2026-02-10T01:19:11Z

## Comprehensive MCP Debugger Test Suite (E2E)

**Primary Purpose:** End-to-end test suite that validates all 19 MCP debugger tools across 6 language adapters (Python, JavaScript, Rust, Go, Java, Mock) in a matrix format. Produces detailed PASS/FAIL/SKIP reports for each tool-language combination.

### Core Components

#### Result Tracking System (L25-41)
- `ToolStatus` type: PASS | FAIL | SKIP | PENDING status enumeration
- `ToolResult` interface: Records tool name, language, status, detail message, and execution duration
- `record()` function (L37): Centralized result logging with console output and icon formatting
- Global `results` array: Accumulates all test results for final matrix report

#### Language Configuration (L75-90)
- `LangDef` interface: Defines language properties including script paths, breakpoint lines, and availability
- `LANGUAGES` array (L83): Configuration for all 6 supported languages with toolchain detection
- Toolchain detection (L60-71): Uses `hasCommand()` to check for Rust/Go/Java availability via CLI version checks

#### Test Infrastructure (L118-163)
- MCP client setup with StdioClientTransport connecting to debugger server
- Per-test session cleanup in `afterEach()` to prevent session leakage
- 30-second timeout for initial connection, 90-second timeout for full debug workflows

### Tool Test Categories

#### Language-Agnostic Tools (L169-201)
- `list_supported_languages` (L169): Single test returning available language adapters
- `list_debug_sessions` (L192): Tests session enumeration (both empty and with active sessions)

#### Per-Language Tool Matrix (L207-674)
Each language gets comprehensive test coverage for:

**Session Management:**
- `create_debug_session` (L221): Creates named debug sessions per language
- `set_breakpoint` (L262): Sets breakpoints at predefined executable lines
- `get_source_context` (L287): Retrieves source code around breakpoint locations

**Full Debug Workflows (L316-507):**
For real languages (non-mock), executes complete debugging cycle:
1. Session creation and breakpoint setup
2. `start_debugging` with launch arguments and 4-second breakpoint wait
3. Stack inspection: `get_stack_trace`, `get_scopes`, `get_variables`, `get_local_variables`
4. Expression evaluation with "1 + 2" test
5. Step operations: `step_over`, `step_into`, `step_out` with 2-second delays
6. `continue_execution` to resume program flow
7. `close_debug_session` cleanup

**Mock Adapter Handling (L510-579):**
Simplified test suite for mock adapter with limited operations and explicit skip recording for unsupported tools.

**Process Attachment Tools (L584-672):**
- `pause_execution` (L584): Tests "not implemented" behavior expectation
- `attach_to_process` (L612): Attempts localhost:5678 attachment, expects connection failures
- `detach_from_process` (L649): Tests detachment without active process

### Key Constants & Dependencies
- Example script paths (L45-56): Predefined test scripts for each language with known breakpoint lines
- Tool enumeration (L94-114): Complete list of all 19 MCP debugger tools
- Utility imports: `parseSdkToolResult`, `callToolSafely` from smoke-test-utils for error handling

### Reporting & Output (L678-721)
- `printSummary()` function: Generates ASCII matrix table showing tool×language status grid
- JSON result export to `comprehensive-test-results.json` for automated report generation
- Real-time console logging with Unicode status icons (✓/✗/⊘/…)

### Error Handling Strategy
- Non-failing approach: Individual tool failures don't stop test execution
- Expected error categorization: Connection refused for attach operations, step_out failures at top frame
- Graceful degradation: Missing frameId/scopeRef results in SKIPs rather than failures

**Architecture Note:** This is a comprehensive integration test designed for CI/CD validation of the entire MCP debugger toolchain, with emphasis on matrix completeness over individual tool deep-dive testing.
# scripts/test-mcp-integration.sh
@source-hash: ed9d30e761e197ad
@generated: 2026-02-10T00:42:04Z

## Purpose
Integration test script that validates MCP (Model Context Protocol) server compliance and integration with external tools. Tests JSON-RPC protocol implementation, tool availability, and Claude CLI integration.

## Key Functions

### `run_test()` (L24-45)
Core testing function that executes MCP server requests and validates responses.
- Parameters: test name, JSON-RPC input, expected output pattern
- Executes server via Node.js with 2-second timeout
- Uses grep pattern matching for response validation
- Updates global test counters (`TESTS_PASSED`, `TESTS_FAILED`)

## Test Suite Structure

### Test 1: Initialize Request (L48-50)
Validates MCP protocol initialization with proper version negotiation.
- Sends `initialize` method with protocol version "2024-11-05"
- Expects response containing protocol version confirmation

### Test 2: Clean Output Validation (L53-63)
Ensures server produces valid JSON without log contamination.
- Uses Python JSON parser for validation
- Checks absence of log timestamp patterns (`^\[.*\]`)

### Test 3: Tools List (L66-68)
Verifies tool discovery functionality.
- Sends `tools/list` method
- Expects `create_debug_session` tool in response

### Test 4: Auto-detection (L71-79)
Tests server's ability to detect stdio mode without explicit argument.
- Runs server without `stdio` parameter
- Non-blocking test (warning vs failure)

### Test 5: Claude CLI Integration (L82-94)
Validates external Claude CLI MCP configuration.
- Checks if `mcp-debugger` is listed in Claude's MCP registry
- Verifies connection status
- Provides remediation steps if not configured

## Architecture & Dependencies

### Path Resolution (L7-8)
- `SCRIPT_DIR`: Script's directory location
- `PROJECT_DIR`: Parent directory containing server distribution

### Output Formatting (L14-17)
ANSI color codes for test result visualization:
- `GREEN`: Success indicators
- `RED`: Failure indicators  
- `YELLOW`: Warning indicators
- `NC`: Reset color

### External Dependencies
- Node.js runtime for MCP server execution
- Python 3 with `json.tool` for JSON validation
- Claude CLI at `/home/ubuntu/.claude/local/claude`
- Timeout utility for process management

## Test Execution Model
Sequential test execution with cumulative pass/fail tracking. Each test is independent but contributes to overall suite success. Non-zero exit code on any failure enables CI/CD integration.

## Critical Constraints
- 1-2 second timeouts prevent hanging on server issues
- Hardcoded Claude CLI path assumes Ubuntu installation
- Requires pre-built distribution at `$PROJECT_DIR/dist/index.js`
- JSON-RPC 2.0 protocol compliance expected
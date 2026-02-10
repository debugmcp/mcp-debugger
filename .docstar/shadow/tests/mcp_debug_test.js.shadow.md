# tests/mcp_debug_test.js
@source-hash: 0d02e455df317a71
@generated: 2026-02-09T18:15:16Z

## Primary Purpose
Integration test script for the debug-mcp-server that exercises MCP (Model Context Protocol) debugging tools through HTTP requests, simulating how an LLM would interact with Python debugging capabilities.

## Key Functions

### `callTool(toolName, args)` (L17-45)
Core utility function that makes HTTP POST requests to the MCP server endpoint. Handles JSON serialization, error handling, and response logging. Makes requests to `${MCP_SERVER_URL}/mcp-tool` with structured payload containing server name, tool name, and arguments.

### `sleep(ms)` (L48-50)
Simple Promise-based delay utility for coordinating test timing, particularly waiting for breakpoint hits.

### `runTest()` (L53-171)
Main test orchestrator that executes a complete debugging workflow:
- Creates debug session for Python (L60-63)
- Sets breakpoint at line 38 of fibonacci.py (L74-78)
- Starts debugging session (L88-91)
- Retrieves variables at breakpoint (L104-106)
- Evaluates expression `fibonacci_iterative(n)` (L113-116)
- Performs step-over operation (L123-125)
- Gets stack trace (L135-137)
- Continues execution (L144-146)
- Closes debug session (L156-158)

## Configuration & Dependencies

### Constants (L11-14)
- `MCP_SERVER_URL`: Server endpoint (default localhost:3000)
- `TEST_SCRIPT_PATH`: Target Python script for debugging (fibonacci.py)
- `SERVER_NAME`: MCP server identifier ('debug-mcp-server')

### Dependencies (L8-9)
- `node-fetch`: HTTP client for MCP server communication
- `path`: File system path utilities

## Test Workflow Architecture
Implements a linear 9-step debugging simulation that mirrors typical LLM debugging patterns:
1. Session creation → 2. Breakpoint setting → 3. Debug start → 4. Variable inspection → 5. Expression evaluation → 6. Step execution → 7. Stack analysis → 8. Continue → 9. Cleanup

## Error Handling
Each MCP tool call includes success validation and descriptive error messages. Global error handling terminates process with exit code 1 on failures (L168-170, L174-177).

## Target Integration
Designed to test the complete MCP debugging tool chain against a Python fibonacci implementation with intentional bugs, validating tool responses match expected debugging interaction patterns.
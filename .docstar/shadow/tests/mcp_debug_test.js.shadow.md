# tests/mcp_debug_test.js
@source-hash: 0d02e455df317a71
@generated: 2026-02-10T00:42:01Z

## Purpose

Integration test script for the debug-mcp-server, simulating how an LLM would interact with debugging tools through the MCP (Model Context Protocol). Exercises a complete debugging workflow against a Python Fibonacci example script.

## Key Components

### Configuration (L11-14)
- `MCP_SERVER_URL`: HTTP endpoint for MCP server (default localhost:3000)
- `TEST_SCRIPT_PATH`: Target Python script for debugging (fibonacci.py)  
- `SERVER_NAME`: MCP server identifier ("debug-mcp-server")

### Core Functions

**`callTool(toolName, args)` (L17-45)**
- Generic MCP tool invocation wrapper
- Makes HTTP POST requests to `/mcp-tool` endpoint
- Handles request/response serialization and error logging
- Returns parsed JSON response

**`sleep(ms)` (L48-50)**
- Simple async delay utility for test synchronization

**`runTest()` (L53-171)**
- Main orchestration function executing 9-step debugging workflow:
  1. Create debug session (L60-70)
  2. Set breakpoint at line 38 (L74-84)
  3. Start debugging session (L88-95)
  4. Retrieve variables at breakpoint (L104-109)
  5. Evaluate expression (L113-119) 
  6. Step over execution (L123-131)
  7. Get stack trace (L135-140)
  8. Continue execution (L144-152)
  9. Close session (L156-164)

## Architecture

### Communication Pattern
Uses HTTP-based MCP protocol with JSON payloads containing:
- `server_name`: Target MCP server identifier
- `tool_name`: Specific debugging tool to invoke
- `arguments`: Tool-specific parameters

### Error Handling
- HTTP status validation in `callTool`
- Success flag validation after each tool call
- Process exits with code 1 on any failure
- Comprehensive error logging throughout

### Dependencies
- `node-fetch`: HTTP client for MCP server communication
- `path`: File system path utilities

## Test Flow
Simulates realistic debugging session: session creation → breakpoint setup → execution control → state inspection → cleanup. Validates each step's success before proceeding, ensuring robust integration testing of the complete MCP debugging toolchain.
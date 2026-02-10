# examples/python_simple_swap/debug_swap_demo.py
@source-hash: 9f508f7ef12f1eea
@generated: 2026-02-09T18:14:59Z

## Purpose
Demonstration script for debugging Python code through an MCP (Model Context Protocol) debug server. Orchestrates a complete debugging workflow by setting breakpoints, stepping through code execution, and inspecting variables in a target Python script (`swap_vars.py`).

## Key Functions

### `call_mcp_tool()` (L16-61)
**Core MCP communication handler**
- Sends JSON-RPC 2.0 requests to debug server at `MCP_SERVER_URL`
- Manages session IDs via HTTP headers (`mcp-session-id`)
- Handles response parsing with robust JSON deserialization fallback
- Returns tuple of (processed_result, session_id)

### `run_debug_session()` (L63-287)
**Main debugging workflow orchestrator**
- Creates debug session for Python language
- Sets breakpoint at line 9 of target script
- Starts debugging and waits for breakpoint hit
- Inspects stack frames and variable scopes
- Steps over single line execution
- Compares variable values before/after step
- Ensures proper session cleanup in finally block

## Architecture & Dependencies
- **HTTP Client**: Uses `requests` for MCP server communication
- **Target Script**: References `swap_vars.py` via absolute path resolution (L14)
- **Protocol**: JSON-RPC 2.0 with MCP-specific headers
- **Session Management**: Tracks both HTTP session and debug session IDs

## Critical Workflow Steps
1. **Session Creation** (L75-86): Establishes debug session with server
2. **Breakpoint Setup** (L90-101): Sets breakpoint at line 9 of target
3. **Debug Start** (L105-117): Launches script execution until breakpoint
4. **State Inspection** (L119-193): Captures stack, scopes, and variables
5. **Step Execution** (L195-204): Steps over single line of code
6. **State Verification** (L207-256): Re-inspects variables after step
7. **Cleanup** (L275-286): Closes debug session regardless of errors

## Invariants & Constraints
- Expects `swap_vars.py` with variables `a=10, b=20` at breakpoint line 9
- Validates all API responses as dictionaries with required fields
- Uses 1-based line numbering for breakpoints
- Assumes first stack frame contains current execution context
- Requires "Locals" scope to exist for variable inspection

## Error Handling Patterns
- Extensive type checking and assertion validations
- Graceful degradation for unparseable JSON responses
- Try-finally pattern ensures session cleanup
- Detailed error messages with context for debugging failures
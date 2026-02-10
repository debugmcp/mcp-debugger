# examples/python_simple_swap/debug_swap_demo.py
@source-hash: 9f508f7ef12f1eea
@generated: 2026-02-10T00:41:46Z

## Primary Purpose
Python demonstration script that showcases debugging capabilities through a debug MCP (Model Context Protocol) server. The script debugs a companion file `swap_vars.py` by setting breakpoints, stepping through code, and inspecting variable states during execution.

## Key Functions

### `call_mcp_tool()` (L16-61)
Core utility function for communicating with the debug MCP server:
- Sends JSON-RPC 2.0 requests to the MCP server endpoint
- Handles session management via `mcp-session-id` headers
- Parses JSON responses and extracts tool results
- Returns both the processed tool result and session ID for chaining calls
- Includes error handling for HTTP and MCP server errors

### `run_debug_session()` (L63-287)
Main orchestration function implementing a complete debug workflow:
1. **Session Creation** (L74-86): Creates debug session with language and name parameters
2. **Breakpoint Setting** (L89-101): Sets breakpoint at line 9 of target script
3. **Debug Start** (L104-117): Launches script execution until breakpoint hit
4. **Stack Inspection** (L119-141): Retrieves stack frames and validates current position
5. **Scope Analysis** (L144-163): Gets variable scopes for the current frame
6. **Variable Inspection** (L166-192): Examines variables before code execution
7. **Step Execution** (L195-204): Steps over the target line (`a = b`)
8. **Post-Step Validation** (L207-256): Re-inspects variables to verify changes
9. **Execution Continuation** (L259-268): Allows script to complete
10. **Cleanup** (L275-286): Closes debug session in finally block

## Dependencies & Configuration
- **HTTP Communication**: `requests` for MCP server interaction
- **Target Script**: `swap_vars.py` in same directory (L14)
- **Server Endpoint**: `http://localhost:3000/mcp` (L11)
- **Session Management**: Uses UUID generation for unique request IDs

## Architectural Patterns
- **JSON-RPC Protocol**: Implements proper JSON-RPC 2.0 message structure
- **Session State Management**: Tracks both HTTP session and debug session IDs
- **Robust Error Handling**: Comprehensive validation of tool responses and data types
- **Resource Cleanup**: Ensures debug sessions are properly closed via finally blocks
- **Synchronous Debugging**: Uses sleep delays to allow async debug operations to complete

## Critical Invariants
- MCP server must be running on specified endpoint before script execution
- Target script `swap_vars.py` must exist and be debuggable
- Debug session lifecycle: create → breakpoint → start → inspect → step → continue → close
- Variable assertions validate expected behavior: `a=10, b=20` before step, `a=20` after step
- All tool calls expect dictionary responses with specific structure validation
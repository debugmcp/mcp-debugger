# examples/python_simple_swap/
@generated: 2026-02-09T18:16:07Z

## Overall Purpose and Responsibility
This directory provides a complete end-to-end demonstration of Python debugging through the MCP (Model Context Protocol) debug server. It showcases how to programmatically debug Python code by orchestrating a full debugging workflow including breakpoint management, step-by-step execution, and variable inspection.

## Key Components and Relationships

### Target Script (`swap_vars.py`)
- **Role**: Educational debugging target containing an intentional variable swap bug
- **Purpose**: Provides a simple, predictable test case for debugging demonstrations
- **Bug Pattern**: Sequential assignment without temporary variable (`a = b; b = a`) resulting in both variables having the same value
- **Expected Behavior**: Always fails to swap correctly, making it ideal for debugging practice

### Debug Orchestrator (`debug_swap_demo.py`)
- **Role**: MCP client that demonstrates complete debugging workflow automation
- **Integration**: Targets `swap_vars.py` specifically, setting breakpoints and inspecting the buggy swap logic
- **Protocol**: Communicates with MCP debug server via HTTP JSON-RPC 2.0 requests
- **Workflow**: Creates session → sets breakpoints → starts debugging → inspects state → steps through code → verifies changes

## Public API and Entry Points

### Primary Entry Point
- **`debug_swap_demo.py`** (command-line execution): Runs complete debugging demonstration
- **Environment**: Expects MCP debug server running at `MCP_SERVER_URL`

### Core Functions
- **`call_mcp_tool()`**: Generic MCP server communication handler
- **`run_debug_session()`**: Complete debugging workflow orchestrator
- **`swap_variables()`**: Buggy target function for debugging practice

## Internal Organization and Data Flow

### Communication Flow
1. **HTTP Client** (`debug_swap_demo.py`) → **MCP Debug Server** (external)
2. **Debug Server** manages **Python Interpreter** running `swap_vars.py`
3. **Session Management**: Maintains both HTTP session and debug session contexts
4. **State Synchronization**: Captures and compares variable states before/after operations

### Debugging Workflow
```
Session Creation → Breakpoint Setup → Script Launch → 
State Inspection → Step Execution → State Verification → Cleanup
```

### Critical Integration Points
- **Line 9 Breakpoint**: Set at the first buggy assignment (`a = b`) in `swap_variables()`
- **Variable Tracking**: Monitors `a` and `b` values through the "Locals" scope
- **Stack Frame Analysis**: Inspects execution context at breakpoint

## Important Patterns and Conventions

### Error Handling
- Robust JSON response parsing with fallback mechanisms
- Comprehensive validation of MCP API responses
- Try-finally patterns for guaranteed session cleanup
- Detailed error messages with debugging context

### Educational Design
- **Intentional Bug**: `swap_vars.py` demonstrates classic programming mistake
- **Predictable Behavior**: Always produces same incorrect result for consistent testing
- **Clear Output**: Debug prints and validation messages for learning

### Protocol Compliance
- **JSON-RPC 2.0**: Standard request/response format
- **MCP Headers**: Session ID management via `mcp-session-id`
- **1-based Line Numbers**: Follows debugging convention for breakpoint specification

This module serves as both a functional debugging demonstration and a template for building MCP-based debugging tools, showcasing proper session management, error handling, and debugging workflow automation.
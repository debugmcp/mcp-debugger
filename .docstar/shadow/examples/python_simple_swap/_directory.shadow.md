# examples/python_simple_swap/
@generated: 2026-02-11T23:47:40Z

## Overall Purpose and Responsibility

This directory contains a complete educational debugging demonstration that showcases MCP (Model Context Protocol) server debugging capabilities. The module serves as both a tutorial and practical example of how to use debug MCP servers to identify and analyze bugs in Python code through programmatic debugging sessions.

## Key Components and Relationships

### Core Components
- **`swap_vars.py`**: Target script containing an intentionally buggy variable swap implementation that serves as the debugging subject
- **`debug_swap_demo.py`**: MCP client demonstration script that programmatically debugs the swap script using a debug MCP server

### Component Interaction Flow
1. **`debug_swap_demo.py`** acts as the MCP client, connecting to a debug server at `http://localhost:3000/mcp`
2. Creates a debug session targeting **`swap_vars.py`** as the subject script
3. Orchestrates a complete debugging workflow: breakpoints → execution → inspection → stepping → validation
4. Demonstrates how the buggy swap function in `swap_vars.py` fails to properly exchange variable values

## Public API Surface

### Main Entry Points
- **`debug_swap_demo.py`**: Primary executable that runs the complete debugging demonstration
- **`swap_vars.py`**: Standalone buggy script that can be executed independently or debugged

### Key Functions
- **`run_debug_session()`**: Main orchestration function implementing the full debugging workflow
- **`call_mcp_tool()`**: Core utility for MCP server communication via JSON-RPC 2.0
- **`swap_variables(a, b)`**: Intentionally flawed swap implementation for debugging practice

## Internal Organization and Data Flow

### Debugging Workflow Architecture
1. **Session Management**: Establishes and maintains both HTTP sessions and debug server sessions
2. **Breakpoint Control**: Sets strategic breakpoints to pause execution at critical points
3. **State Inspection**: Captures and analyzes variable states, stack frames, and execution context
4. **Step-by-Step Execution**: Demonstrates controlled code stepping and state transitions
5. **Validation Logic**: Verifies expected vs. actual behavior to identify bugs

### Data Flow Pattern
```
MCP Client → JSON-RPC Requests → Debug Server → Target Script Execution
         ← Tool Responses ← State Information ← Variable Inspection
```

## Important Patterns and Conventions

### Educational Design Patterns
- **Intentional Bug Introduction**: `swap_vars.py` contains a documented logical error for learning purposes
- **Complete Debug Lifecycle**: Demonstrates proper session creation, execution control, and cleanup
- **Assertion-Based Validation**: Uses variable state assertions to verify debugging effectiveness
- **Synchronous Debugging**: Implements proper timing and state management for debug operations

### Technical Conventions
- **JSON-RPC 2.0 Protocol**: Strict adherence to MCP communication standards
- **Session State Tracking**: Maintains both HTTP session cookies and debug session IDs
- **Resource Management**: Ensures proper cleanup of debug sessions via finally blocks
- **Error Handling**: Comprehensive validation of server responses and debugging state

## Dependencies and Requirements
- **Runtime**: Python with `requests` library for HTTP communication
- **External Service**: Debug MCP server running on `localhost:3000`
- **File Structure**: Both scripts must be in the same directory for proper relative path resolution

This module serves as both a practical debugging tutorial and a reference implementation for MCP-based debugging workflows, making it valuable for learning debugging concepts and MCP server integration patterns.
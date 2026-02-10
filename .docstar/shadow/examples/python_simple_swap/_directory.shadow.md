# examples/python_simple_swap/
@generated: 2026-02-10T01:19:39Z

## Overall Purpose and Responsibility

This directory provides a complete **debugging workflow demonstration** using the Model Context Protocol (MCP). It showcases how to use a debug MCP server to programmatically debug Python code by implementing a realistic debugging scenario with an intentionally buggy target script.

## Key Components and Relationships

The module consists of two complementary Python files that work together to demonstrate MCP debugging capabilities:

- **`debug_swap_demo.py`** - The primary demonstration script that acts as a debug client
- **`swap_vars.py`** - Target script containing an intentional bug for debugging practice

### Component Interaction Flow
1. `debug_swap_demo.py` launches and connects to an MCP debug server
2. It loads `swap_vars.py` as the target for debugging  
3. Sets breakpoints and steps through the buggy swap function
4. Inspects variable states before and after the problematic code execution
5. Validates that the debugging workflow correctly identifies the variable swap failure

## Public API Surface

### Main Entry Point
- **`run_debug_session()`** - Complete debugging workflow orchestration
- **`call_mcp_tool()`** - Generic MCP server communication utility

### Debug Workflow Operations
- Session management (create/close debug sessions)
- Breakpoint management (set breakpoints at specific lines)  
- Execution control (start, step, continue)
- State inspection (stack frames, variable scopes, variable values)

## Internal Organization and Data Flow

### Architecture Pattern
The module implements a **synchronous debugging client** using JSON-RPC 2.0 protocol:

```
Debug Client → MCP Server → Python Debugger → Target Script
     ↑                                              ↓
     ←── Debug Events & State Information ←────────
```

### Data Flow Sequence
1. **Session Establishment**: Creates debug session with server
2. **Breakpoint Configuration**: Sets breakpoint at critical line (L9 in swap function)
3. **Execution Launch**: Starts target script until breakpoint hit
4. **State Capture**: Retrieves stack frames and variable scopes
5. **Pre-execution Inspection**: Captures initial variable values (a=10, b=20)
6. **Step Execution**: Steps over the buggy assignment line
7. **Post-execution Validation**: Verifies the bug manifestation (both vars = 20)
8. **Cleanup**: Properly closes debug session

## Important Patterns and Conventions

### MCP Communication Pattern
- **JSON-RPC 2.0 Protocol**: Standardized request/response structure
- **Session State Management**: Tracks both HTTP and debug session IDs
- **Error Handling**: Comprehensive validation of server responses
- **Resource Management**: Ensures proper cleanup via finally blocks

### Debugging Workflow Pattern
- **Defensive Programming**: Validates each debug operation before proceeding  
- **State Verification**: Asserts expected conditions at each step
- **Educational Design**: Clear demonstration of common debugging operations

### Configuration Requirements
- MCP debug server running on `localhost:3000/mcp`
- Target script must exist in same directory
- Server must support standard debug operations (breakpoints, stepping, inspection)

## Key Educational Value
This example serves as a **comprehensive reference implementation** for:
- MCP debug server integration
- Programmatic debugging workflows
- Common debugging operations (breakpoints, stepping, variable inspection)
- Error identification in educational contexts

The intentional bug in `swap_vars.py` provides a realistic debugging scenario where the expected behavior fails, demonstrating how MCP debugging tools can identify and analyze runtime issues.
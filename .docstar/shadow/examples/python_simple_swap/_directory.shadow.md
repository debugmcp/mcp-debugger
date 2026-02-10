# examples/python_simple_swap/
@generated: 2026-02-10T21:26:18Z

## Overall Purpose and Responsibility

This directory provides a complete educational debugging demonstration showcasing how to use an MCP (Model Context Protocol) debug server to interactively debug Python code. The module consists of a buggy target script and a comprehensive debugging client that demonstrates remote debugging capabilities through JSON-RPC protocol communication.

## Key Components and Relationships

### Core Components
- **`swap_vars.py`**: Target script containing an intentionally flawed variable swap implementation that serves as the debugging subject
- **`debug_swap_demo.py`**: MCP debug client that remotely debugs the swap script through a complete debugging workflow

### Component Interaction Flow
1. The debug client (`debug_swap_demo.py`) connects to an external MCP debug server
2. Creates a debug session targeting `swap_vars.py`
3. Sets breakpoints and controls execution of the target script
4. Inspects variables and stack frames during execution
5. Demonstrates the bug discovery process by comparing variable states before and after execution

## Public API Surface

### Main Entry Points
- **`debug_swap_demo.py`**: Primary executable that runs the complete debugging demonstration
  - `run_debug_session()`: Main orchestration function implementing full debug workflow
  - `call_mcp_tool()`: Utility for MCP server communication
- **`swap_vars.py`**: Standalone buggy script that can be executed independently for testing

### External Dependencies
- **MCP Debug Server**: Must be running on `http://localhost:3000/mcp`
- **HTTP Communication**: Uses `requests` library for JSON-RPC protocol
- **Target Environment**: Python runtime capable of executing both scripts

## Internal Organization and Data Flow

### Debugging Workflow Architecture
1. **Session Management**: Establishes and maintains debug session state
2. **Breakpoint Control**: Sets strategic breakpoints at critical code locations
3. **Execution Control**: Manages script execution flow (start, step, continue)
4. **State Inspection**: Retrieves and validates variable states and stack frames
5. **Verification Logic**: Compares expected vs actual behavior to identify bugs
6. **Resource Cleanup**: Ensures proper session termination

### Data Flow Pattern
```
MCP Client → JSON-RPC Request → MCP Server → Python Debugger → Target Script
         ← JSON-RPC Response ← MCP Server ← Debug Information ← Target Script
```

## Important Patterns and Conventions

### Educational Design Patterns
- **Intentional Bug Pattern**: `swap_vars.py` contains a well-known programming error (improper variable swap)
- **Comprehensive Debugging**: Demonstrates complete debugging lifecycle from setup to teardown
- **Verification Strategy**: Includes assertions and validations to confirm bug detection

### Technical Conventions
- **JSON-RPC 2.0 Protocol**: Strict adherence to JSON-RPC messaging standards
- **Session State Management**: Maintains both HTTP and debug session identifiers
- **Error Handling**: Comprehensive validation and error recovery mechanisms
- **Synchronous Operation**: Uses deliberate delays to coordinate with asynchronous debug operations

### Code Organization
- **Separation of Concerns**: Clean separation between debug client and target script
- **Resource Management**: Proper cleanup patterns with try/finally blocks
- **Modular Functions**: Well-defined functions with specific responsibilities

This module serves as both a practical demonstration of MCP debugging capabilities and an educational resource for understanding remote debugging workflows, making it valuable for learning both debugging techniques and MCP protocol usage.
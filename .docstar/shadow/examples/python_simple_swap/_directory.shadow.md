# examples\python_simple_swap/
@generated: 2026-02-12T21:00:55Z

## Overall Purpose
This directory contains a complete educational debugging demonstration that showcases how to use MCP (Model Context Protocol) debugging capabilities. It provides a practical example of remote debugging workflow by debugging an intentionally buggy Python script through a debug MCP server.

## Key Components and Architecture

### Primary Components
- **`debug_swap_demo.py`**: The main demonstration script that acts as a debug client, connecting to an MCP debug server to perform interactive debugging operations
- **`swap_vars.py`**: A simple target script containing an intentionally buggy variable swap function that serves as the debugging subject

### Component Interaction
The components work together in a client-target debugging relationship:
1. `debug_swap_demo.py` establishes connection to MCP debug server
2. Server loads and debugs `swap_vars.py` as the target script
3. Demo script orchestrates complete debugging session through JSON-RPC calls
4. The intentional bug in `swap_vars.py` provides concrete debugging behavior to observe

## Public API Surface

### Main Entry Points
- **`debug_swap_demo.py`** - Primary executable that runs the full debugging demonstration
- **`swap_vars.py`** - Can be executed standalone to observe buggy behavior

### Key Functions
- `run_debug_session()` - Main orchestration function implementing complete debug workflow
- `call_mcp_tool()` - Core utility for MCP server communication
- `swap_variables()` - The buggy function being debugged

## Internal Organization and Data Flow

### Debug Workflow Sequence
1. **Session Management**: Creates debug session via MCP server
2. **Breakpoint Setup**: Sets breakpoint at critical line in target script
3. **Execution Control**: Starts execution and pauses at breakpoint
4. **State Inspection**: Examines stack frames, scopes, and variable values
5. **Step Debugging**: Steps through problematic code line
6. **Validation**: Verifies variable changes after step execution
7. **Cleanup**: Properly closes debug session

### Communication Protocol
- Uses JSON-RPC 2.0 over HTTP for MCP server communication
- Maintains session state through `mcp-session-id` headers
- Implements comprehensive error handling for network and protocol issues

## Important Patterns and Conventions

### Educational Design
- **Intentional Bug**: `swap_vars.py` contains classic variable assignment error for learning
- **Comprehensive Validation**: Demo script includes assertions to verify expected vs actual behavior
- **Trace Output**: Both scripts include print statements for execution visibility

### Debugging Best Practices
- **Resource Management**: Proper cleanup of debug sessions in finally blocks
- **State Verification**: Multiple checkpoints to validate debugging state
- **Error Resilience**: Robust error handling throughout the debugging process

### Prerequisites
- MCP debug server must be running on `localhost:3000/mcp`
- Target script must be accessible in the same directory
- Python environment with `requests` library available

This directory serves as a complete, self-contained example of how to implement programmatic debugging workflows using MCP protocols, making it valuable for both learning debugging concepts and understanding MCP integration patterns.
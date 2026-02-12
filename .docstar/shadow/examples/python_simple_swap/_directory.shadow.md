# examples\python_simple_swap/
@generated: 2026-02-12T21:05:43Z

## Overall Purpose
This directory contains a complete debugging demonstration system that showcases MCP (Model Context Protocol) server debugging capabilities. The module implements a client-server debugging scenario where one script orchestrates the debugging of another, serving as both an educational example and a functional test of debugging tools.

## Key Components and Relationships

### Core Components
- **`debug_swap_demo.py`** - Primary orchestration script that acts as an MCP client
- **`swap_vars.py`** - Target script containing an intentional bug for debugging demonstration

### Component Interaction Flow
1. `debug_swap_demo.py` connects to an MCP debugging server (expected at `localhost:3000/mcp`)
2. Creates a debug session for `swap_vars.py`
3. Sets breakpoints and steps through the buggy swap implementation
4. Inspects variable states before and after critical operations
5. Validates the debugging process by detecting the swap bug
6. Demonstrates proper session cleanup and resource management

## Public API Surface

### Main Entry Points
- **`run_debug_session()`** - Primary function demonstrating complete debugging workflow
- **`call_mcp_tool()`** - Utility function for MCP server communication
- **`main()` (in swap_vars.py)** - Target debugging subject with intentional bug

### External Dependencies
- MCP debugging server running on `http://localhost:3000/mcp`
- Python `requests` library for HTTP communication
- JSON-RPC 2.0 protocol compliance

## Internal Organization and Data Flow

### Debug Session Lifecycle
1. **Session Creation** → **Breakpoint Setup** → **Execution Start**
2. **State Inspection** → **Step Execution** → **Post-Step Validation**  
3. **Continuation** → **Session Cleanup**

### Data Flow Patterns
- JSON-RPC 2.0 messages with UUID request tracking
- Session ID propagation for stateful debugging operations
- Variable state snapshots at critical execution points
- Structured error handling with comprehensive validation

## Important Patterns and Conventions

### Architectural Patterns
- **Client-Server Debugging**: Demonstrates remote debugging via MCP protocol
- **Educational Bug Pattern**: Intentional swap bug (missing temporary variable) for learning
- **Robust Session Management**: Proper resource cleanup via finally blocks
- **Assertion-Based Validation**: Variable state verification before/after operations

### Testing and Validation
- Pre-condition checks (variables: a=10, b=20)
- Post-condition validation (detecting failed swap)
- Stack frame and scope inspection
- Comprehensive error handling for network and protocol failures

### Educational Value
This module serves as a practical example of:
- MCP server integration for debugging tools
- Common programming error patterns (variable swapping)
- Proper debugging session lifecycle management
- JSON-RPC protocol implementation in Python

The directory effectively demonstrates how debugging tools can be integrated via standardized protocols while providing hands-on learning opportunities for common programming mistakes.
# examples/asciinema_demo/
@generated: 2026-02-10T21:26:53Z

## Purpose

A complete demonstration package showcasing MCP (Model Context Protocol) debugging capabilities through an interactive terminal-based debugging session. Combines a buggy event processing script with a rich terminal UI debugger to demonstrate real-time debugging workflows, breakpoint management, and code execution visualization.

## Key Components

### buggy_event_processor.py
Demonstration target containing intentionally buggy event processing logic with common copy/reference issues. Features:
- Event transformation pipeline with shallow copy protection
- Priority classification and value transformation logic
- Special revert functionality that introduces reference bugs
- Built-in test data and verification logic for debugging exercises

### run_rich_demo.py
Interactive terminal UI that serves as both MCP client and demo orchestrator. Provides:
- Split-pane Rich terminal interface (debug logs + syntax-highlighted source)
- MCP server lifecycle management (Node.js subprocess)
- Real-time debugging workflow demonstration
- Breakpoint visualization and execution line tracking

## Demo Architecture & Data Flow

**Setup Phase:**
1. `run_rich_demo.py` validates file paths and launches Node.js MCP debugger server
2. Establishes MCP communication channel via JSON-RPC over subprocess pipes
3. Creates debug session targeting `buggy_event_processor.py`

**Interactive Debugging:**
1. Sets breakpoint at critical line (L13) in event processing logic
2. Starts debug execution of the buggy script
3. Handles debug events (stopped, breakpoint hit) with UI updates
4. Displays execution state through syntax highlighting and line markers

**State Visualization:**
- Left pane: Real-time debug log messages with styled output
- Right pane: Source code with breakpoint markers ("B>") and execution pointer ("H>")
- Automatic UI refresh after each debugging operation

## Public API Surface

### Entry Points
- **run_rich_demo.py**: Main demo executable - launches complete debugging demonstration
- **buggy_event_processor.py**: Standalone script that can be debugged independently

### Key Functions
- `process_events(events, important_threshold=5)`: Core buggy logic demonstration
- `start_mcp_server()`: MCP debugger server initialization
- `send_mcp_request(tool_name, arguments)`: MCP protocol communication
- `update_code_pane()`: Terminal UI rendering with syntax highlighting

## Internal Organization

**Communication Layer:**
- Synchronous MCP request/response pattern with JSON serialization
- Asynchronous event handling for debug state changes
- Subprocess management for Node.js MCP server lifecycle

**UI Management:**
- Rich library components for professional terminal interface
- State-driven rendering with execution line tracking
- Log buffer management with overflow protection

**Demo Orchestration:**
- Hardcoded debugging workflow with visualization delays
- Error handling for graceful demo execution
- Progressive server shutdown (wait → terminate → kill)

## Important Patterns

**Bug Demonstration Strategy:**
- Intentional copy/reference bugs in event processing
- Built-in verification logic to detect and explain issues
- Test data designed to trigger specific bug conditions

**MCP Integration:**
- Simplified MCP client implementation for demo purposes
- Mixed sync/async communication patterns
- Manual event polling for UI responsiveness

**Terminal UI Conventions:**
- "B>" prefix for breakpoint lines
- "H>" prefix for current execution line  
- Styled log messages for different event types
- Split-pane layout for simultaneous code and log viewing

This demo package serves as a complete reference implementation for MCP debugging workflows, combining realistic buggy code with professional debugging visualization tools.
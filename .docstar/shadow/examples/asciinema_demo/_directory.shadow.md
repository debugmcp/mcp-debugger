# examples/asciinema_demo/
@generated: 2026-02-09T18:16:15Z

## Overall Purpose
This directory contains a complete demonstration setup for an MCP (Model Context Protocol) debugger system. It showcases a Python debugging workflow through a rich terminal UI that connects to an MCP server, demonstrating real-time debugging capabilities with visual feedback including breakpoint management, execution tracking, and source code display.

## Key Components and Integration

### Debug Target (`buggy_event_processor.py`)
- **Role**: Demo application designed to showcase debugging scenarios
- **Features**: Event processing system with intentional reference vs. copy handling patterns
- **Debug Points**: Contains strategic logic for breakpoint demonstration (priority processing, special revert handling)
- **Data Flow**: Processes events through copy creation → default assignment → priority processing → special revert handling

### Debug Client (`run_rich_demo.py`)
- **Role**: MCP protocol client with rich terminal UI
- **Architecture**: Split-pane interface (debug logs + syntax-highlighted source code)
- **Integration**: Manages complete debug lifecycle from session creation to cleanup
- **UI Features**: Real-time breakpoint visualization, execution line highlighting, event log display

## Public API Surface

### Main Entry Points
- **`run_rich_demo.py`**: Primary demonstration script
  - Configurable target script and MCP server paths
  - Self-contained demo flow with built-in validation
  - Rich terminal UI with split-pane layout

### MCP Protocol Interface
- **Session Management**: `create_debug_session`, `close_debug_session`
- **Breakpoint Control**: `set_breakpoint` with line number targeting
- **Execution Control**: `start_debugging` with event handling
- **Inspection**: `get_stack_trace` for execution state analysis

## Internal Organization and Data Flow

### Communication Architecture
```
Terminal UI ←→ MCP Client ←→ Node.js MCP Server ←→ Python Debugger
```

### Processing Pipeline
1. **Initialization**: Validate paths, spawn MCP server subprocess
2. **UI Setup**: Create Rich layout with log/code panes, load target source
3. **Debug Session**: Create session, set breakpoints, start debugging
4. **Event Loop**: Handle stop/breakpoint events, update UI state
5. **Inspection**: Get stack traces, highlight current execution lines
6. **Cleanup**: Close session, terminate server process

### State Synchronization
- **UI State**: `log_lines`, `current_line_highlight`, `breakpoint_lines`
- **Protocol State**: `mcp_request_id_counter`, `current_mcp_session_id`
- **Process State**: `mcp_server_process` subprocess management

## Important Patterns and Conventions

### MCP Protocol Implementation
- **Request/Response Pattern**: Synchronous communication with JSON payloads
- **Event Handling**: Asynchronous event processing during debugging sessions
- **Error Handling**: Graceful degradation with subprocess management safeguards

### UI/UX Patterns
- **Real-time Updates**: Live refresh of execution state and log information
- **Visual Indicators**: Distinct markers for breakpoints ("B>") and execution ("H>")
- **Syntax Highlighting**: Manual Python keyword highlighting for code display

### Demo Orchestration
- **Self-Validation**: Built-in checks for required files and dependencies
- **Graceful Cleanup**: Proper subprocess termination and resource management
- **Educational Focus**: Clear demonstration of debugging workflow stages

## Dependencies
- **Rich**: Terminal UI framework for layout and styling
- **subprocess**: MCP server process lifecycle management
- **json**: MCP protocol message serialization
- **pathlib**: Cross-platform file system operations

This directory serves as a complete working example of MCP debugger integration, suitable for demonstration, testing, and educational purposes around modern debugging protocol implementations.
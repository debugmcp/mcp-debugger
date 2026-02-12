# examples\asciinema_demo/
@generated: 2026-02-12T21:05:45Z

## Overall Purpose

This directory contains a complete asciinema demo showcasing MCP (Model Context Protocol) debugging capabilities. It demonstrates an interactive debugging workflow using a Rich-based terminal UI to debug intentionally buggy Python code, specifically illustrating common copy/reference bugs in data processing pipelines.

## Key Components and Integration

**buggy_event_processor.py** - The debug target containing intentional bugs in event processing logic with shallow copy and reference management issues. Serves as the specimen for debugging demonstrations.

**run_rich_demo.py** - The main demo orchestrator that provides a sophisticated terminal UI for debugging the buggy processor. Creates a split-pane interface showing debug logs and syntax-highlighted source code with breakpoint and execution line markers.

The components work together in a client-server debugging architecture where the Rich demo acts as an MCP client, launching and communicating with an external Node.js MCP server (located at `dist/index.js`) to debug the buggy processor script.

## Public API and Entry Points

**Primary Entry Point:**
- `run_rich_demo.py` - Main executable that starts the complete debugging demonstration

**Demo Workflow API:**
- Session management via MCP `create_debug_session` tool
- Breakpoint control through MCP protocol
- Real-time execution monitoring with UI updates
- Event processing verification and bug detection

## Internal Organization and Data Flow

**Initialization Phase:**
1. Validates existence of target script and MCP server
2. Sets up Rich terminal UI with three-panel layout
3. Launches Node.js MCP server as subprocess

**Debugging Phase:**
1. Creates debug session targeting `buggy_event_processor.py`
2. Sets strategic breakpoints in event processing logic
3. Executes buggy code with real-time UI feedback
4. Captures execution state and highlights current line
5. Demonstrates bug detection in copy/reference handling

**Communication Flow:**
- Synchronous MCP request/response for control operations
- Asynchronous event polling for execution state updates
- JSON-based protocol for all MCP server communication

## Important Patterns and Conventions

**Demo Architecture:**
- **Target-Observer Pattern**: Buggy processor serves as observable target, Rich demo as observer
- **Protocol Abstraction**: MCP protocol abstracts debugging operations across language boundaries
- **UI State Synchronization**: Terminal UI reflects debugging state in real-time

**Bug Demonstration Strategy:**
- **Intentional Defects**: Processor contains carefully crafted copy/reference bugs
- **Verification Logic**: Built-in assertions detect when bugs manifest
- **Educational Focus**: Clear visualization of common Python pitfalls

**Error Resilience:**
- Graceful server shutdown with progressive escalation
- File validation before execution
- Robust subprocess management with timeout handling

## Educational Value

This demo effectively illustrates:
- MCP protocol integration for cross-language debugging
- Common Python copy semantics pitfalls
- Rich terminal UI development patterns
- Subprocess communication and lifecycle management
- Interactive debugging workflow design

The directory serves as both a functional debugging demo and a reference implementation for MCP-based debugging tools.
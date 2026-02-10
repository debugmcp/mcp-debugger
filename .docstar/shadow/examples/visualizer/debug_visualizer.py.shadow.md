# examples/visualizer/debug_visualizer.py
@source-hash: cb80f5a47c5ece53
@generated: 2026-02-10T00:41:45Z

## Primary Purpose
Main TUI application for the MCP debugger visualizer that provides a live terminal interface for debugging sessions with real-time code viewing, tool activity monitoring, and state management.

## Core Components

**DebugVisualizer Class (L24-255)**
- Main application orchestrating the TUI layout and state updates
- Manages Rich console, layout, and live refresh loop
- Coordinates three specialized panels: header, tools, and code view
- Handles external debug session control through public API methods

**Key Dependencies**
- `ToolActivityPanel`, `CodeViewPanel`, `HeaderPanel` from `.panels` - UI rendering components
- `DebugState` from `.state` - centralized state management
- Rich library for terminal UI (Console, Layout, Live, Panel, Text)

## Layout Architecture (L42-63)
Three-region layout:
- Header (L53): Fixed 3-row height for session info
- Body split into two columns:
  - Tools panel (L59): 2/5 width ratio for tool activity
  - Code panel (L60): 3/5 width ratio for source code display

## Update Methods (L65-123)
- `update_header()` (L65): Session info, location, pause state
- `update_tools_panel()` (L82): Tool activity log
- `update_code_panel()` (L87): Source code with breakpoints/variables
- `render()` (L107): Orchestrates all updates with error handling

## Live Display Loop (L125-143)
- 4 FPS refresh rate (L130, L136)
- Uses Rich Live with alternate screen buffer
- Graceful keyboard interrupt handling

## External Control API (L147-254)
Session management:
- `create_session()` (L147), `close_session()` (L246)

Breakpoint control:
- `set_breakpoint()` (L159)

Execution control:
- `start_debugging()` (L178), `pause_at_breakpoint()` (L191)
- `step_to_line()` (L221), `continue_execution()` (L237)

State updates:
- `update_variables()` (L207)

All control methods update both state and tool activity log for visual feedback.

## Entry Point
`main()` (L257) provides standalone execution with basic setup and keyboard interrupt handling.
# examples/visualizer/debug_visualizer.py
@source-hash: cb80f5a47c5ece53
@generated: 2026-02-09T18:15:00Z

## Purpose
Main TUI application controller for MCP debugger visualizer. Orchestrates Rich-based terminal interface with live updates, manages debug session state, and provides API for external debug tool integration.

## Core Architecture

### Main Class: DebugVisualizer (L24-254)
Primary application controller that coordinates all TUI components:

- **Initialization (L27-40)**: Sets up Rich console, debug state, panel instances, and layout
- **Layout Management (L42-63)**: Creates 3-section layout (header + 2-column body) with tools:code ratio of 2:3
- **Render Pipeline (L107-123)**: Updates all panels with error handling, returns complete layout
- **Live Display Loop (L125-139)**: Runs at 4Hz refresh rate using Rich Live with alternate screen buffer

### Panel Update Methods
- **update_header() (L65-80)**: Renders session info and current location via HeaderPanel
- **update_tools_panel() (L82-85)**: Displays tool activity feed via ToolActivityPanel  
- **update_code_panel() (L87-105)**: Shows source code with current line, breakpoints, and variables via CodeViewPanel

## State Management API

### Session Control (L147-157, L246-254)
- **create_session()**: Initializes new debug session with ID and optional name
- **close_session()**: Resets session state and logs closure

### Breakpoint Management (L159-176)
- **set_breakpoint()**: Adds breakpoint and updates location if no current location exists

### Execution Control (L178-244)
- **start_debugging()**: Logs script start
- **pause_at_breakpoint()**: Sets paused state and updates location
- **step_to_line()**: Updates location for step operations (over/into/out)
- **continue_execution()**: Clears paused state
- **update_variables()**: Refreshes variable display

## Dependencies
- **Rich Components**: Console, Layout, Live, Panel, Text for TUI rendering
- **Internal Modules**: 
  - `.panels` for ToolActivityPanel, CodeViewPanel, HeaderPanel
  - `.state` for DebugState management
- **Standard Library**: time, typing, os, sys

## Key Patterns
- **Error Isolation**: Render pipeline catches exceptions and displays errors in red panel
- **State Synchronization**: All external API calls log activities to tool panel
- **Graceful Shutdown**: KeyboardInterrupt handling with cleanup messages
- **Live Updates**: Continuous 4Hz refresh cycle with manual update triggers

## Entry Point
**main() (L257-268)**: Standalone runner with basic usage instructions and keyboard interrupt handling
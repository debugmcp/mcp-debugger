# examples/visualizer/panels.py
@source-hash: e1bbe717b1559fad
@generated: 2026-02-09T18:14:58Z

## Purpose
Rich-based UI panel components for MCP debugger visualizer. Provides specialized display panels for tool activity tracking, code viewing with debug markers, and session status headers.

## Key Components

### ToolActivityPanel (L22-77)
Displays MCP tool execution history with status icons and formatting.
- `__init__()` (L25-36): Sets up status icons (⟳, ✓, ✗) and color mappings
- `render(activities)` (L38-77): Creates Rich Panel with formatted tool activities
  - Handles empty state with "No activity yet" message
  - Applies status-based styling (blue/green/red for calling/success/error)
  - Groups activities with details on indented lines

### CodeViewPanel (L80-238)
Main code display panel with syntax highlighting, breakpoints, and variable inspection.
- `__init__()` (L83-85): Initializes with CodeWindow (20-line window size)
- `render()` (L87-199): Primary rendering method taking file_path, current_line, breakpoints, variables
  - Uses `_determine_focus_line()` for smart positioning
  - Displays line numbers with markers (● for breakpoints, → for current line)
  - Highlights current execution line with grey23 background
  - Adds variables section below code with separator
  - Creates title showing filename and line range
- `_determine_focus_line()` (L201-229): Priority-based line focusing logic:
  1. Current execution line
  2. First breakpoint in file  
  3. Default to line 1
- `clear_cache()` (L231-238): Delegates cache clearing to CodeWindow

### HeaderPanel (L241-290)
Static session information display panel.
- `render()` (L244-290): Static method creating session status header
  - Shows "MCP Debugger" title with session ID/name
  - Displays current location and execution state
  - Uses blinking red "[PAUSED]" or green "[RUNNING]" status indicators

## Dependencies
- Rich library components: Panel, Syntax, Table, Text, Group, Columns
- Internal: `.state.ToolActivity`, `.code_window.CodeWindow`
- Standard: os, typing

## Architecture Patterns
- Component-based UI with separate concerns (activity, code, header)
- Rich-based rendering with consistent styling patterns
- Status-driven formatting with predefined color schemes
- Hierarchical content organization with Groups and separators
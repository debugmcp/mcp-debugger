# examples/visualizer/panels.py
@source-hash: e1bbe717b1559fad
@generated: 2026-02-10T00:41:41Z

## Purpose
Rich-based UI panel components for MCP debugger visualizer interface. Provides three specialized panels for displaying tool activity, syntax-highlighted code view, and session status information.

## Core Components

### ToolActivityPanel (L22-77)
Displays MCP tool execution history with status indicators.
- `__init__()` (L25-36): Sets up status icons (⟳, ✓, ✗) and color mappings
- `render(activities)` (L38-77): Creates Rich Panel showing tool activities with formatted status, tool names, and details

### CodeViewPanel (L80-238)
Main code display with syntax highlighting, breakpoints, and execution markers.
- `__init__()` (L83-85): Initializes with CodeWindow(window_size=20)
- `render()` (L87-199): Core rendering method handling file display, line numbers, breakpoint markers (●), current line markers (→), and variables section
- `_determine_focus_line()` (L201-229): Focus priority logic: current line > first breakpoint > line 1
- `clear_cache()` (L231-238): Delegates cache clearing to underlying CodeWindow

### HeaderPanel (L241-290)
Session information and execution status display.
- `render()` (L244-290): Static method creating header with session ID, name, location, and pause/running status

## Key Dependencies
- Rich library components: Panel, Syntax, Table, Text, Group, Columns
- Local imports: ToolActivity from state module, CodeWindow from code_window module

## Visual Formatting Patterns
- Status colors: blue (calling), green (success), red (error)
- Marker styling: Red breakpoints, yellow current line, combined red-on-yellow
- Current line highlighting with "on grey23" background
- Variables displayed with cyan names, yellow values
- Consistent panel styling with colored borders and padding

## Data Flow
Receives structured data (activities, file paths, breakpoints, variables) and transforms into Rich renderable components. CodeViewPanel delegates file reading and windowing logic to CodeWindow helper class.
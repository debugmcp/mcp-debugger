# examples\visualizer/
@generated: 2026-02-12T21:05:55Z

## Purpose and Responsibility
The `examples/visualizer` module provides a comprehensive terminal-based user interface (TUI) system for visualizing MCP (Model Context Protocol) debugging sessions in real-time. It processes debug server logs to create interactive visual representations of code execution, breakpoints, variable states, and tool activities through a Rich-based terminal interface.

## Core Architecture Components

### Live Visualization System
- **DebugVisualizer**: Main TUI orchestrator managing Rich console layout and coordinating three specialized panels
- **Panels Module**: Three Rich-based UI components:
  - `HeaderPanel`: Session status and execution context
  - `CodeViewPanel`: Syntax-highlighted source code with breakpoints and execution markers  
  - `ToolActivityPanel`: MCP tool invocation history with status indicators
- **CodeWindow**: Sliding window manager for source code display with smooth scrolling and file caching

### Log Processing Pipeline
- **LogWatcher**: Real-time file monitoring with position persistence and rotation handling
- **LogEventParser**: Structured event parser that maps MCP debug events to visualizer state updates
- **DebugState**: Centralized state management for sessions, breakpoints, variables, and tool activities

### Demo and Recording Infrastructure
- **demo_runner.py**: Complete demo orchestration launching MCP server and visualizer
- **demo_mock.py**: Mock debugging session simulator for standalone demonstrations
- **live_visualizer.py**: Integration layer connecting log monitoring to visualization
- Recording utilities: `record_session.py`, `convert_to_gif.py`, `optimize_gif.py` for creating documentation assets

## Public API and Entry Points

### Primary Entry Points
- **`live_visualizer.py`**: Main production entry point for monitoring live MCP server logs
- **`demo_runner.py`**: Full demo environment launcher with server and visualizer coordination
- **`demo_mock.py`**: Standalone mock demonstration without server dependency

### Core Classes (External Interface)
- **`DebugVisualizer`**: Main visualizer class with methods for session control (`create_session`, `close_session`), breakpoint management (`set_breakpoint`), execution control (`start_debugging`, `pause_at_breakpoint`, `step_to_line`, `continue_execution`), and state updates (`update_variables`)
- **`LogWatcher`**: File monitoring with event callback registration via `on_event(event_type, callback)`
- **`LogEventParser`**: Event processing with methods for each MCP event type (`parse_tool_call`, `parse_debug_state`, etc.)

## Data Flow and Integration

### Event Processing Chain
1. **LogWatcher** monitors MCP server log files using polling with position persistence
2. **LogEventParser** processes structured JSON events and updates **DebugState**
3. **DebugVisualizer** renders state changes through specialized panels at 4 FPS refresh rate
4. **CodeWindow** provides file content with smooth scrolling and visual markers

### State Management
- **DebugState**: Centralized storage for session data, execution location, breakpoints (file → line set mapping), variables, and bounded tool activity history (20 entries max)
- **ToolActivity**: Immutable records tracking MCP tool invocations with status and timing
- **CodeLocation**: File path and line number representation with display formatting

## Key Patterns and Conventions

### Visual Design
- **Layout**: Three-region layout (header/tools/code) with responsive 2:3 ratio for tools:code panels
- **Markers**: Red bullets (●) for breakpoints, yellow arrows (→) for current execution line
- **Status Colors**: Blue (calling), green (success), red (error) for tool activities
- **Syntax Highlighting**: Rich-based with theme support and line number display

### File and Path Handling
- **Path Normalization**: Consistent absolute path conversion using pathlib
- **File Caching**: CodeWindow caches loaded files with selective invalidation
- **Encoding Resilience**: Multiple encoding fallbacks (UTF-8 → Latin-1 → CP1252 → binary)
- **Position Persistence**: LogWatcher maintains read position across restarts

### Error Handling and Robustness
- **Graceful Degradation**: File access errors result in error display rather than crashes
- **Thread Safety**: Daemon threads with proper cleanup and timeout handling
- **Process Management**: Comprehensive subprocess lifecycle management with signal handling
- **Memory Management**: Bounded collections and automatic cleanup for long-running sessions

## Dependencies and Integration
- **Rich Library**: Terminal UI rendering, syntax highlighting, and layout management
- **Standard Library**: Core functionality using `pathlib`, `subprocess`, `threading`, `json`
- **MCP Server Integration**: Expects structured JSON debug events in log files
- **External Tools**: Optional integration with `agg` (GIF conversion) and `gifsicle` (optimization)

The visualizer serves as both a development tool for MCP debugging and a demonstration platform showcasing protocol capabilities through rich terminal interfaces.
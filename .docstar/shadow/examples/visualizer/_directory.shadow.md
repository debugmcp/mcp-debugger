# examples/visualizer/
@generated: 2026-02-10T21:26:28Z

## MCP Debugger TUI Visualizer

This directory provides a terminal-based user interface (TUI) for visualizing debugging sessions from MCP (Model Context Protocol) debugger server logs. It transforms structured debug logs into a real-time, interactive terminal visualization showing code execution, tool activity, and debugging state.

## Overall Architecture

The visualizer follows a modular, event-driven architecture with three main layers:

1. **Log Processing Layer**: Monitors and parses MCP server debug logs
2. **State Management Layer**: Centralizes debugging session state
3. **UI Rendering Layer**: Rich-based terminal interface components

## Core Components

### Primary Entry Points
- **`live_visualizer.py`**: Main entry point for live debugging sessions - monitors log files and renders real-time TUI
- **`demo_mock.py`**: Standalone mock demo showcasing visualizer capabilities without live server
- **`demo_runner.py`**: Complete demo orchestration managing both MCP server and visualizer processes

### Data Flow Pipeline
1. **`log_watcher.py`** (LogWatcher): Tails MCP server logs with file rotation handling and event dispatching
2. **`log_parser.py`** (LogEventParser): Parses structured JSON debug events and updates state
3. **`state.py`** (DebugState): Centralized state management for sessions, breakpoints, variables, and tool activity
4. **`debug_visualizer.py`** (DebugVisualizer): Main TUI orchestrator coordinating all UI components

### UI Components
- **`panels.py`**: Three Rich-based panels:
  - **ToolActivityPanel**: MCP tool execution history with status indicators
  - **CodeViewPanel**: Syntax-highlighted code with breakpoints and execution markers
  - **HeaderPanel**: Session information and execution status
- **`code_window.py`** (CodeWindow): Sliding window manager for code display with caching and smooth scrolling

## Key Features

### Real-time Visualization
- Live log monitoring with 4 FPS refresh rate
- Syntax-highlighted code display with ~20 line sliding window
- Visual markers for breakpoints (●) and current execution (→)
- Tool activity tracking with status indicators (⟳, ✓, ✗)

### State Management
- Session lifecycle tracking (created/closed)
- Breakpoint management per file with automatic cleanup
- Variable inspection with truncation (60 chars, max 20 vars)
- Tool activity history with bounded storage (20 entries)

### File Handling
- Multi-encoding file loading (UTF-8, Latin-1, CP1252) with fallbacks
- Robust path normalization across platforms
- File caching for performance optimization
- Graceful handling of file rotation and deletion

## Public API (DebugVisualizer)

### Session Control
- `create_session(session_id, name)`: Initialize debugging session
- `close_session()`: End current session
- `start_debugging(file_path, line)`: Begin debug execution
- `pause_at_breakpoint(file_path, line)`: Handle breakpoint hits

### Execution Control  
- `step_to_line(file_path, line)`: Step execution to specific location
- `continue_execution()`: Resume from breakpoint
- `set_breakpoint(file_path, line)`: Add breakpoint
- `update_variables(variables_dict)`: Update variable state

## Utility Scripts

### Demo and Recording
- **`prepare_demo_recording.py`**: Environment cleanup for demo recordings
- **`record_session.py`**: Asciinema recording configuration for demos
- **`convert_to_gif.py`**: Convert terminal recordings to optimized GIF format
- **`optimize_gif.py`**: Progressive GIF compression with gifsicle
- **`optimize_screenshots.py`**: PNG/WebP optimization for documentation

### Testing and Development
- **`test_log_watcher.py`**: Integration tests for log monitoring functionality
- **`test_panels.py`**: Visual debugging for UI panel components  
- **`test_path_issue.py`**: Path normalization debugging utilities

## Dependencies

### External
- **Rich**: Terminal UI framework for panels, syntax highlighting, and layout
- **PIL/Pillow**: Image optimization for screenshots
- **asciinema**: Terminal recording (demo utilities)
- **gifsicle**: GIF optimization (demo utilities)

### Internal Architecture Patterns
- **Event-driven design**: Callback registration for decoupled log event handling
- **Producer-consumer model**: Log watcher feeds events to UI visualizer
- **Immutable state updates**: Clean state transitions with dataclass records
- **Resource pooling**: File caching and bounded activity history
- **Graceful degradation**: Comprehensive error handling throughout pipeline

## Usage Patterns

1. **Live Debugging**: Run `live_visualizer.py` with MCP server log path
2. **Demo Mode**: Execute `demo_mock.py` for self-contained demonstration
3. **Full Demo**: Use `demo_runner.py` to orchestrate server + visualizer
4. **Recording**: Chain `prepare_demo_recording.py` → `record_session.py` → `convert_to_gif.py`

The visualizer provides a complete debugging experience by transforming structured MCP server logs into an intuitive, real-time terminal interface showing code execution flow, variable states, and tool interactions.
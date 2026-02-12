# examples/visualizer/
@generated: 2026-02-11T23:47:52Z

## Purpose and Responsibility
This directory provides a complete Terminal User Interface (TUI) visualizer for MCP (Model Context Protocol) debugging sessions. It offers real-time visualization of debugging state, tool activity, code execution, and variable inspection through a rich terminal interface that can monitor live MCP server logs or run mock demonstrations.

## Key Components and Architecture

### Core Application Framework
- **DebugVisualizer (`debug_visualizer.py`)**: Main TUI application orchestrating a three-panel Rich-based interface with header (session info), tools panel (activity log), and code panel (syntax-highlighted source with markers)
- **DebugState (`state.py`)**: Centralized state management storing session data, breakpoints, variables, tool activities, and current execution location
- **Panel Components (`panels.py`)**: Rich-based UI components for rendering tool activities, code views with breakpoints/execution markers, and session headers

### Log Processing Pipeline
- **LogWatcher (`log_watcher.py`)**: Real-time file monitoring with position persistence, rotation handling, and event dispatching to registered callbacks
- **LogEventParser (`log_parser.py`)**: Structured log event processor that parses MCP debug events (`tool:call/response`, `session:created/closed`, `debug:state/breakpoint/variables`) and updates visualizer state
- **Live Integration (`live_visualizer.py`)**: Bridge component connecting log monitoring to visualization with comprehensive event handler registration

### Code Display System
- **CodeWindow (`code_window.py`)**: Smart sliding window manager providing ~20-line code views with smooth scrolling, file caching, breakpoint markers (●), and execution indicators (→)
- Supports multi-file debugging with per-file window state and robust encoding fallback (UTF-8 → Latin-1 → CP1252 → binary)

### Demo and Testing Infrastructure
- **Mock Demo (`demo_mock.py`)**: Standalone simulation showcasing visualizer capabilities with a 19-step debugging session of a variable swap bug
- **Live Demo (`demo_runner.py`)**: Process orchestration launching both MCP server and visualizer for end-to-end demonstrations
- **Recording Tools**: Complete workflow for creating documentation including session recording (`record_session.py`), GIF conversion (`convert_to_gif.py`), and optimization (`optimize_gif.py`, `optimize_screenshots.py`)

## Public API Surface

### Main Entry Points
- **`live_visualizer.py`**: Primary entry point for live MCP server log monitoring
- **`demo_mock.py`**: Standalone demo without external dependencies
- **`demo_runner.py`**: Full system demo with MCP server integration

### DebugVisualizer Control API
- **Session Management**: `create_session()`, `close_session()`
- **Execution Control**: `start_debugging()`, `pause_at_breakpoint()`, `step_to_line()`, `continue_execution()`
- **Breakpoint Management**: `set_breakpoint()`
- **State Updates**: `update_variables()`

### Component APIs
- **LogWatcher**: `on_event()` callback registration, `start()/stop()` lifecycle management
- **CodeWindow**: `get_window()` for formatted code display, cache management methods
- **Panels**: Rich-based `render()` methods for UI component generation

## Data Flow and Integration

1. **Live Mode**: LogWatcher monitors MCP server logs → LogEventParser processes structured events → DebugState updates → DebugVisualizer renders TUI
2. **Mock Mode**: Threaded simulation directly calls DebugVisualizer API methods to demonstrate functionality
3. **Code Display**: CodeWindow provides windowed file views with visual markers fed to CodeViewPanel for Rich rendering

## Key Patterns and Conventions

- **Event-driven architecture**: Callback-based log event processing with type-specific handlers
- **State centralization**: Single DebugState instance maintaining all session data
- **Rich-based UI**: Consistent use of Rich library for terminal rendering with colored panels and syntax highlighting
- **Graceful degradation**: Robust error handling with fallbacks (encoding, file access, malformed JSON)
- **Position persistence**: Log watcher maintains read position across restarts
- **Memory management**: Bounded tool activity history (20 entries) and variable display limits

## Dependencies and Requirements

- **Core**: Rich library for terminal UI, standard library components
- **External Tools**: Node.js MCP server, asciinema (recording), gifsicle/agg (optimization)
- **File Structure**: Expects MCP server at `dist/index.js`, logs at `logs/debug-mcp-server.log`
- **Demo Files**: Requires `examples/python_simple_swap/swap_vars.py` for demonstrations

This visualizer serves as both a development tool for MCP debugging and a demonstration platform showcasing protocol debugging capabilities through comprehensive terminal-based visualization.
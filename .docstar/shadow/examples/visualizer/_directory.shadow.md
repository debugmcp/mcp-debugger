# examples/visualizer/
@generated: 2026-02-10T01:19:49Z

## Purpose

The `examples/visualizer` directory provides a comprehensive terminal-based user interface (TUI) system for visualizing and debugging MCP (Model Context Protocol) sessions in real-time. It serves as both a demonstration tool and a practical debugging aid that processes MCP server logs to create interactive visual representations of debugging sessions.

## Core Architecture

The visualizer follows a **modular event-driven architecture** with clear separation of concerns:

### UI Layer (`panels.py`, `debug_visualizer.py`)
- **DebugVisualizer**: Main TUI orchestrator managing Rich console layout and live refresh
- **Panel Components**: Three specialized panels for tool activity, code view, and session status
- **CodeWindow**: Dynamic sliding window manager for source code display with syntax highlighting

### Data Processing Layer (`log_watcher.py`, `log_parser.py`, `state.py`)
- **LogWatcher**: Real-time log file monitoring with position persistence and file rotation handling
- **LogEventParser**: Structured event processor that translates MCP log events into state updates
- **DebugState**: Centralized state management for sessions, breakpoints, variables, and tool activities

### Integration Layer (`live_visualizer.py`)
- Bridges file monitoring with UI visualization
- Registers event handlers and coordinates component lifecycle
- Provides the main entry point for live debugging sessions

## Key Entry Points

### Primary Interfaces
- **`live_visualizer.py`**: Main entry point for live MCP debugging sessions
- **`demo_mock.py`**: Standalone mock demonstration without MCP server dependency
- **`demo_runner.py`**: Complete end-to-end demo orchestrating both MCP server and visualizer

### Utility Scripts
- **`record_session.py`**: Creates asciinema recordings for documentation
- **`convert_to_gif.py`**: Converts recordings to optimized GIFs
- **`optimize_*.py`**: File optimization utilities for web delivery

## Component Relationships

```
MCP Server Logs → LogWatcher → LogEventParser → DebugState → DebugVisualizer
                                                     ↓
                                            Panel Components
                                                     ↓
                                              Rich TUI Output
```

### Data Flow
1. **LogWatcher** monitors MCP server debug logs for new structured events
2. **LogEventParser** processes events and updates **DebugState** with session info, breakpoints, variables
3. **DebugVisualizer** orchestrates three panels using current state:
   - **ToolActivityPanel**: Shows MCP tool execution history with status indicators
   - **CodeViewPanel**: Displays source code with breakpoints, execution markers, and variables
   - **HeaderPanel**: Shows session information and execution status
4. **CodeWindow** provides sliding window logic for efficient code display

## Public API Surface

### DebugVisualizer Control Methods
- Session management: `create_session()`, `close_session()`
- Breakpoint control: `set_breakpoint()`
- Execution control: `start_debugging()`, `pause_at_breakpoint()`, `step_to_line()`, `continue_execution()`
- State updates: `update_variables()`

### LogWatcher Interface
- Event registration: `on_event(event_type, callback)`
- Lifecycle: `start()`, `stop()`
- Position management: automatic persistence for session resume

## Key Features

### Visual Capabilities
- **Real-time code visualization**: 20-line sliding windows with syntax highlighting
- **Execution tracking**: Visual markers for breakpoints (●) and current line (→)
- **Variable inspection**: Live display of scope variables with type information
- **Tool activity monitoring**: Status-coded tool execution history
- **Multi-file support**: Per-file window state and caching

### Technical Features
- **File rotation handling**: Robust log monitoring across server restarts
- **Position persistence**: Resume capability without reprocessing old events
- **Smooth scrolling**: Edge-triggered window updates for stable UX
- **Error resilience**: Graceful handling of file encoding issues and malformed events
- **Thread safety**: Non-blocking background monitoring with proper cleanup

## Development Patterns

### State Management
- Immutable dataclasses for events and locations
- Centralized state with bounded memory (20 tool activities max)
- Dict-based breakpoint storage with automatic cleanup

### Error Handling
- Multi-encoding fallback for source files (UTF-8 → Latin-1 → CP1252 → binary)
- Silent error handling in simulation threads to prevent TUI corruption
- Graceful degradation for missing files or malformed events

### Performance Optimization
- File caching to minimize I/O operations
- 4 FPS refresh rate for responsive UI without excessive CPU usage
- Sliding window algorithm reduces memory footprint for large files

## Dependencies

**Core Libraries**: Rich (TUI framework), pathlib (cross-platform paths), subprocess (external tool integration)

**External Tools**: Node.js (MCP server), asciinema (recording), agg/gifsicle (media optimization)

The visualizer is designed to be both a practical debugging tool for MCP development and a comprehensive demonstration of real-time log visualization techniques in terminal environments.
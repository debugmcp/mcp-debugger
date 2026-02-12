# examples\visualizer/
@generated: 2026-02-12T21:01:07Z

## MCP Debugger TUI Visualizer

**Purpose**: A comprehensive terminal-based user interface (TUI) system for visualizing MCP (Model Context Protocol) debugging sessions in real-time. Provides live monitoring of debug server logs, interactive code viewing with breakpoints, tool activity tracking, and session state management.

## Core Components

### Main Applications
- **debug_visualizer.py**: Primary TUI application orchestrating a Rich-based interface with three panels (header, tools, code view) and external control API for debugging operations
- **live_visualizer.py**: Integration layer that connects log file monitoring to the TUI, parsing MCP server logs and dispatching events to visualization components
- **demo_mock.py**: Standalone mock demonstration that simulates a complete debugging session without requiring actual MCP infrastructure

### State Management
- **state.py**: Centralized state management with `DebugState` class tracking session info, execution location, breakpoints, variables, and tool activities with bounded history (20 entries)
- **log_parser.py**: Event processor that parses structured MCP log events and updates visualizer state according to logging specifications

### UI Components
- **panels.py**: Rich-based UI panels providing specialized views:
  - `ToolActivityPanel`: Tool execution history with status indicators
  - `CodeViewPanel`: Syntax-highlighted code with breakpoints and execution markers  
  - `HeaderPanel`: Session information and status display
- **code_window.py**: Dynamic sliding window manager for source code display (~20 lines) with smooth scrolling, multi-file caching, and visual markers

### Infrastructure
- **log_watcher.py**: Real-time log file monitor using polling with position persistence, file rotation detection, and event dispatching to registered callbacks

## Demo and Utility Tools

### Demo Orchestration
- **demo_runner.py**: Complete demo orchestrator that launches MCP debug server and visualizer processes with lifecycle management
- **prepare_demo_recording.py**: Environment cleanup utility for pristine demo recordings
- **record_session.py**: Asciinema-based terminal session recorder for demo screencasts

### Asset Management
- **convert_to_gif.py**: Converts asciinema recordings to optimized GIF animations using `agg` tool
- **optimize_gif.py**: Progressive GIF optimization using gifsicle with 4-level compression strategy
- **optimize_screenshots.py**: PNG/WebP optimization for web delivery while maintaining authenticity

### Testing
- **test_log_watcher.py**: Integration tests for log watching functionality with event validation
- **test_panels.py**: Visual debugging for CodeViewPanel rendering scenarios
- **test_path_issue.py**: Path normalization debugging for cross-platform compatibility

## Public API Surface

### Primary Entry Points
- `DebugVisualizer.main()`: Standalone TUI execution
- `live_visualizer.main()`: Live log monitoring with command-line log path
- `demo_mock.main()`: Mock session demonstration
- `demo_runner.main()`: Full demo orchestration

### External Control API (DebugVisualizer)
- Session management: `create_session()`, `close_session()`
- Breakpoint control: `set_breakpoint()`
- Execution control: `start_debugging()`, `pause_at_breakpoint()`, `step_to_line()`, `continue_execution()`
- State updates: `update_variables()`

## Data Flow Architecture

1. **Log Monitoring**: `LogWatcher` tails MCP server log files, detecting new structured JSON events
2. **Event Processing**: `LogEventParser` parses events and updates `DebugState` with session, breakpoint, and variable changes
3. **UI Rendering**: Three specialized panels consume state and render Rich-based TUI at 4 FPS
4. **Code Display**: `CodeWindow` provides sliding window views with syntax highlighting and execution markers
5. **Interactive Control**: External API allows programmatic control of debugging operations

## Key Patterns

- **Event-driven architecture**: Log events drive state updates and UI refresh cycles
- **Producer-Consumer**: Separate threads handle log monitoring and UI rendering
- **Centralized state**: Single `DebugState` instance coordinates all component interactions
- **Bounded resources**: Automatic history trimming and memory management
- **Cross-platform compatibility**: Path normalization and encoding fallbacks throughout
- **Progressive optimization**: Multi-level compression strategies for media assets

## Critical Dependencies

- **Rich library**: Terminal UI framework for panels, syntax highlighting, and layout
- **MCP debug server**: Expected to write structured JSON events to monitored log files
- **External tools**: `agg` (GIF conversion), `gifsicle` (GIF optimization), `asciinema` (recording)
- **File structure**: Assumes project layout with `logs/`, `assets/`, and `examples/` directories

This visualizer provides a complete solution for MCP debugging visualization, from real-time monitoring to demo asset generation, with robust error handling and cross-platform compatibility.
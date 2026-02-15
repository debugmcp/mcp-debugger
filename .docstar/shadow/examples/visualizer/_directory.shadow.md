# examples\visualizer/
@children-hash: fb3ce81e2b5dca50
@generated: 2026-02-15T09:01:38Z

## Purpose and Responsibility
This directory contains a comprehensive Terminal User Interface (TUI) visualizer for debugging MCP (Model Context Protocol) sessions. It provides real-time visualization of debugging sessions by monitoring MCP server logs, displaying code execution with syntax highlighting, tracking tool activities, managing breakpoints, and showing variable states in an interactive terminal interface.

## Key Components and Architecture

### Core Application Layer
- **DebugVisualizer** (`debug_visualizer.py`): Main orchestrator class providing the TUI interface with Rich-based layout management. Coordinates three specialized panels (header, tools, code view) and provides external control API for session management, breakpoint control, and execution flow.
- **Live Visualizer** (`live_visualizer.py`): Integration layer that connects log file monitoring to the TUI, serving as the primary entry point for real-time debugging visualization.

### Log Processing Pipeline
- **LogWatcher** (`log_watcher.py`): Real-time log file monitor using polling with position tracking, file rotation detection, and event dispatching to registered callbacks.
- **LogEventParser** (`log_parser.py`): Processes structured MCP log events (tool calls/responses, session lifecycle, debug state changes) and updates visualizer state according to the logging specification.

### User Interface Components
- **Panel System** (`panels.py`): Rich-based UI components including ToolActivityPanel (tool execution history), CodeViewPanel (syntax-highlighted code with markers), and HeaderPanel (session status).
- **CodeWindow** (`code_window.py`): Sliding window code viewer with smart scrolling, breakpoint markers, execution indicators, file caching, and robust encoding support.

### State Management
- **DebugState** (`state.py`): Centralized application state with session tracking, execution location, breakpoint management (dict-based storage), variable states, and bounded tool activity history.
- **Data Models**: ToolActivity and CodeLocation dataclasses for structured data representation.

### Demo and Testing Infrastructure
- **Mock Demo** (`demo_mock.py`): Standalone simulation of complete debugging session for showcasing visualizer capabilities without actual debugging infrastructure.
- **Live Demo Runner** (`demo_runner.py`): Process orchestration script that launches both MCP debug server and visualizer for end-to-end demonstrations.
- **Recording Tools**: Session recording (`record_session.py`), GIF conversion (`convert_to_gif.py`), and optimization utilities for creating documentation assets.

## Public API Surface

### Main Entry Points
- **`live_visualizer.py`**: Primary entry point for real-time log monitoring and visualization
- **`demo_mock.py`**: Standalone demo without external dependencies
- **`demo_runner.py`**: Full demo with MCP server integration

### External Control API (DebugVisualizer)
- Session management: `create_session()`, `close_session()`
- Breakpoint control: `set_breakpoint()` 
- Execution control: `start_debugging()`, `pause_at_breakpoint()`, `step_to_line()`, `continue_execution()`
- State updates: `update_variables()`

## Internal Organization and Data Flow

### Event Processing Flow
1. **LogWatcher** monitors MCP server log files for new JSON events
2. **LogEventParser** processes events and updates **DebugState**
3. **DebugVisualizer** reads state changes and updates UI panels
4. **Panel components** render Rich-based terminal interface at 4 FPS

### Code Visualization Pipeline
1. **CodeViewPanel** determines focus line (current execution > first breakpoint > line 1)
2. **CodeWindow** loads file with encoding fallback, calculates sliding window bounds
3. Window positioning uses smooth scrolling with edge-triggered updates (3-line margin)
4. Visual markers applied: breakpoints (●), current line (→), combined indicators
5. Variables section displays up to 20 variables with value truncation

### State Synchronization
- All components share single **DebugState** instance
- Tool activities bounded to 20 entries for memory management
- Breakpoints stored as file_path → Set[line_numbers] mapping
- Variables replaced entirely on updates (no incremental changes)

## Important Patterns and Conventions

### Path Normalization
- All file paths normalized to absolute canonical form using pathlib
- Cross-platform compatibility with Path.resolve() and os.path.abspath()
- Consistent basename display in UI components

### Error Resilience
- Robust encoding support (UTF-8 → Latin-1 → CP1252 → binary fallback)
- Graceful JSON parsing with malformed data handling
- File rotation detection and position recovery
- Silent error handling in UI update loops to prevent corruption

### Threading and Lifecycle
- LogWatcher uses daemon threads for non-blocking operation
- Graceful shutdown with cleanup handlers (atexit, SIGTERM)
- KeyboardInterrupt handling for clean demo termination
- Position persistence for resume capability across restarts

### Performance Optimizations
- File content caching in CodeWindow to minimize I/O
- Bounded data structures (tool activities, variable display limits)
- Smart window scrolling to reduce unnecessary updates
- 4 FPS refresh rate for responsive but efficient updates
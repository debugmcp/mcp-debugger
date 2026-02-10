# examples/visualizer/
@generated: 2026-02-09T18:16:18Z

## Purpose and Responsibility

The `examples/visualizer` directory provides a complete TUI (Terminal User Interface) visualization system for MCP (Model Context Protocol) debugging sessions. It transforms MCP debugger server logs into real-time visual debugging interfaces, offering live code viewing, breakpoint tracking, variable inspection, and tool activity monitoring.

## Key Components and Architecture

### Core Visualization Engine
- **DebugVisualizer** (`debug_visualizer.py`): Main orchestrator that manages Rich-based TUI with 4Hz refresh cycle, coordinates all panel updates, and provides external API for debug tool integration
- **State Management** (`state.py`): Central state container managing session data, execution location, breakpoints, variables, and tool activity history with automatic memory management
- **Panel Components** (`panels.py`): Rich-based UI components including ToolActivityPanel (MCP tool execution history), CodeViewPanel (syntax-highlighted code with debug markers), and HeaderPanel (session status)

### Live Data Pipeline
- **LogWatcher** (`log_watcher.py`): Real-time log file monitoring with JSON event parsing, position persistence, and callback dispatch system for live updates
- **LogEventParser** (`log_parser.py`): Transforms structured debug events into state updates, handling tool calls, breakpoints, variables, and session management
- **CodeWindow** (`code_window.py`): Smart code viewport manager with 20-line sliding window, smooth scrolling, file caching, and debug marker overlay

### Demo and Recording Infrastructure
- **Live Demo System**: `demo_runner.py` orchestrates MCP server + visualizer, `live_visualizer.py` provides live log-to-TUI bridge
- **Mock Demo System**: `demo_mock.py` provides standalone simulation of complete debugging session for testing/demonstration
- **Recording Tools**: `record_session.py` (asciinema recording), `convert_to_gif.py` (cast-to-GIF conversion), optimization utilities for web delivery

## Public API Surface

### Primary Entry Points
- `live_visualizer.py`: Main entry point for live MCP server log visualization
- `demo_runner.py`: Complete demo environment launching server + visualizer
- `demo_mock.py`: Standalone mock debugging session demonstration

### DebugVisualizer API
```python
# Session Management
create_session(session_id, session_name=None)
close_session()

# Execution Control
start_debugging(script_path)
pause_at_breakpoint(file_path, line)
step_to_line(file_path, line, step_type="over")
continue_execution()

# State Management
set_breakpoint(file_path, line)
update_variables(variables_dict)
```

## Internal Organization and Data Flow

### Event Processing Flow
1. **Log Generation**: MCP server writes structured JSON events to debug log
2. **Event Detection**: LogWatcher monitors file changes, parses JSON events
3. **Event Processing**: LogEventParser transforms events into DebugState updates
4. **UI Rendering**: DebugVisualizer coordinates panel updates at 4Hz refresh rate
5. **Visual Display**: Rich-based TUI displays code, breakpoints, variables, tool activity

### State Synchronization
- **Centralized State**: DebugState object maintains single source of truth
- **Event-Driven Updates**: All state changes flow through structured event processing
- **UI Reactivity**: Visual components automatically reflect state changes through render pipeline

### File Management
- **Path Normalization**: Consistent absolute path handling across all components
- **Code Caching**: File contents cached with encoding fallback strategies
- **Position Tracking**: Persistent file position for reliable log resume functionality

## Important Patterns and Conventions

### Component Integration Pattern
- **Threaded Architecture**: LogWatcher runs in daemon thread, UI runs on main thread
- **Callback Registration**: Event-driven communication between watcher, parser, and visualizer
- **Error Isolation**: Component failures don't cascade, graceful degradation throughout

### Debugging UX Patterns
- **Smart Code Windows**: 20-line viewport with smooth scrolling and edge margin detection
- **Visual Markers**: Consistent breakpoint (●) and current line (→) indicators
- **Status Indicators**: Color-coded tool activity and blinking pause/run state display
- **Progressive Enhancement**: Works with or without breakpoints, variables, current location

### Demo and Documentation
- **Multi-Modal Demos**: Live server integration, mock simulation, and recording capabilities
- **Asset Pipeline**: Automated recording → GIF conversion → web optimization workflow
- **Path Resolution**: Consistent relative path navigation across all demo scripts

### Testing and Development
- **Component Testing**: Isolated tests for panels, log parsing, and path normalization
- **Mock Data**: Comprehensive test events and realistic debugging session simulation
- **Environment Preparation**: Automated cleanup for pristine demo recording state
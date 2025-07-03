# MCP Debug Visualizer

A Rich-based Terminal UI for visualizing MCP debugger sessions.

## Overview

This visualizer provides a real-time view of debugging activity with:
- Two-panel layout (tool activity + code view)
- Dynamic code window that follows execution
- Breakpoint and current line markers
- Variable inspection display
- Session status tracking

## Architecture

### Core Components

1. **`state.py`** - Centralized state management
   - `DebugState`: Main state container
   - `ToolActivity`: Tool invocation tracking
   - `CodeLocation`: File/line tracking

2. **`code_window.py`** - Dynamic code window
   - Sliding window view (default 20 lines)
   - Multi-file support with caching
   - Smooth scrolling behavior
   - Error handling for missing files

3. **`panels.py`** - UI components
   - `ToolActivityPanel`: Shows MCP tool history
   - `CodeViewPanel`: Displays code with syntax highlighting
   - `HeaderPanel`: Session info and status

4. **`debug_visualizer.py`** - Main application
   - Layout management
   - State coordination
   - Live display loop (4fps)
   - External control methods

5. **`demo_mock.py`** - Mock debugging demo
   - Simulates a complete debugging session
   - Tests all visualizer features
   - Uses actual `swap_vars.py` file

## Running the Demo

```bash
cd examples/visualizer
python demo_mock.py
```

The demo will:
1. Create a debug session
2. Set multiple breakpoints
3. Step through code execution
4. Show variable changes
5. Demonstrate window sliding as execution moves

## Key Features

### Dynamic Code Window
- Shows ~20 lines around the point of interest
- Automatically loads files from debugging events
- Smooth scrolling with edge detection
- Caches files for performance

### Visual Markers
- `●` - Breakpoint marker
- `→` - Current execution line
- Combined markers when both apply

### Multi-File Support
- Automatically switches between files
- Maintains separate window state per file
- Handles missing files gracefully

### Tool Activity Tracking
- Icons for different statuses (⟳, ✓, ✗)
- Color-coded status indicators
- Limited history (last 20 activities)

## Live Mode (Task 4)

The visualizer can now connect to the MCP server's log file for real-time debugging visualization.

### New Components

1. **`log_watcher.py`** - Real-time log file monitoring
   - File polling with 0.1s interval
   - Handles file rotation and partial lines
   - Thread-safe operation
   - Position tracking for resume capability

2. **`log_parser.py`** - Event parsing and state updates
   - Parses all event types from logging specification
   - Updates visualizer state based on events
   - Path normalization for consistency
   - Smart formatting of tool details

3. **`live_visualizer.py`** - Live mode integration
   - Connects log watcher to visualizer
   - Registers event handlers
   - Graceful error handling

4. **`demo_runner.py`** - Complete demo orchestration
   - Starts MCP server with logging
   - Launches visualizer
   - Handles cleanup on exit

### Running with Live Logs

1. **Option A: Manual Setup**
   ```bash
   # Terminal 1: Start MCP server
   node dist/index.js --log-level info --log-file logs/debug-mcp-server.log
   
   # Terminal 2: Start visualizer
   cd examples/visualizer
   python live_visualizer.py ../../logs/debug-mcp-server.log
   
   # Terminal 3: Use MCP tools to debug
   # (Use your MCP client to create sessions, set breakpoints, etc.)
   ```

2. **Option B: Demo Runner (Recommended)**
   ```bash
   cd examples/visualizer
   python demo_runner.py
   ```

### Log Watcher Features
- Real-time log file monitoring
- JSON parsing with error handling
- Event-based state updates
- Thread-safe operation
- Automatic file creation if missing
- Handles file rotation gracefully
- Partial line detection and handling
- Position persistence for resume

### Event Types Handled
From the logging specification:
- `tool:call` - Tool invocation started
- `tool:response` - Tool completed successfully
- `tool:error` - Tool failed
- `session:created` - New debug session started
- `session:closed` - Debug session ended
- `debug:state` - Debugger state changed (paused/running)
- `debug:breakpoint` - Breakpoint lifecycle events
- `debug:variables` - Variables retrieved
- `debug:output` - Console output from debugged program

### Testing the Live Mode

1. **With Mock Logs**:
   ```python
   # Create a test log file
   echo '{"message":"session:created","sessionId":"test-123","sessionName":"Test","language":"python","timestamp":1234567890}' >> test.log
   
   # Run visualizer
   python live_visualizer.py test.log
   
   # Append more events to see updates
   echo '{"message":"tool:call","tool":"set_breakpoint","request":{"file":"test.py","line":10},"timestamp":1234567891}' >> test.log
   ```

2. **With Real MCP Server**:
   Use the demo runner and interact with the server through an MCP client.

## Recording Demos

### Quick Start

```bash
# 1. Prepare environment
python prepare_demo_recording.py

# 2. Start the demo runner
python demo_runner.py

# 3. In another terminal, start recording
python record_session.py

# 4. Follow the demo script
# See demo_script.md for detailed commands

# 5. Convert to GIF
python convert_to_gif.py

# 6. Optimize if needed (>10MB)
python optimize_gif.py
```

### Recording Scripts

1. **`prepare_demo_recording.py`** - Clean environment before recording
   - Clears log files
   - Removes position tracking files
   - Ensures clean state

2. **`record_session.py`** - Record with asciinema
   - Sets terminal to 120x30
   - Creates descriptive filename
   - Configures idle time limits

3. **`convert_to_gif.py`** - Convert recording to GIF
   - Uses `agg` for conversion
   - Applies Monokai theme
   - Optimizes playback speed

4. **`demo_script.md`** - Step-by-step demo guide
   - Complete command sequence
   - Timing recommendations (2-3s pauses)
   - Focus on bug discovery moment

5. **`optimize_gif.py`** - Reduce GIF file size
   - Progressive optimization levels
   - Maintains quality while meeting <10MB target
   - Creates backup before optimization

### Demo Workflow

The demo showcases debugging the `swap_vars.py` bug:
1. Create debug session
2. Set breakpoint at line 4 (where bug occurs)
3. Start debugging
4. Show variables (a=10, b=20)
5. Step over to reveal bug (a becomes 20)
6. Continue to completion

Total demo length: ~35 seconds

### Recording Tips

- **Test First**: Do a practice run without recording
- **Clean Terminal**: Start with clear terminal
- **Steady Pace**: Allow 2-3 seconds between commands
- **Highlight Key Moment**: Pause extra when bug appears (step 6)

### Alternative Recording Methods

**Windows**:
```powershell
# Windows Terminal recording
wt record --output demo.txt

# Or use ScreenToGif (GUI tool)
# Download from: https://www.screentogif.com/
```

**Cross-Platform**:
```bash
# terminalizer
npm install -g terminalizer
terminalizer record demo
terminalizer render demo -o assets/demo.gif
```

**Fallback**:
- Use `script` command (Unix)
- Use OBS Studio for screen recording

## Dependencies

- `rich>=13.7.0` - Terminal UI framework

## Error Handling

- Missing files show error message
- Invalid file encodings handled with fallbacks
- Layout errors displayed in UI
- Graceful keyboard interrupt handling

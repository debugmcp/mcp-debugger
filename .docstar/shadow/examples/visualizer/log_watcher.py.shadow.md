# examples/visualizer/log_watcher.py
@source-hash: 577536bf710e4b2c
@generated: 2026-02-09T18:15:01Z

## Primary Purpose
Real-time log file watcher for MCP debugger events that parses JSON log lines and dispatches them to registered callbacks for visualization. Supports file rotation, position persistence, and graceful error handling.

## Key Components

### LogWatcher Class (L18-228)
Main file watcher with threaded log monitoring capabilities.

**Constructor** (L21-36):
- `log_path`: Path to watched log file
- `polling_interval`: Check frequency (default 0.1s)  
- `position`: Current file read position
- `callbacks`: Event type → callback function mapping
- `_position_file`: Persistence file for resume capability

**Event Registration** (L38-46):
- `on_event(event_type, callback)`: Maps event types (e.g., 'tool:call') to callback functions

**Log Processing** (L48-79):
- `parse_log_line(line)`: Parses JSON log lines, filters for registered event types
- Adds `readable_time` field by converting numeric timestamps
- Silently ignores malformed JSON, logs unexpected errors to stderr

**Timestamp Formatting** (L81-92):
- `_format_timestamp(timestamp)`: Converts millisecond Unix timestamp to HH:MM:SS.mmm format

**Position Persistence** (L94-109):
- `_load_position()`: Restores file position from `.visualizer_position`
- `_save_position()`: Saves current position for resume capability

**Core Watching Logic** (L111-198):
- `watch()`: Main polling loop (runs in thread)
- Handles file rotation via inode tracking (L127-135)
- Supports partial line detection and backtrack (L167-171)
- Graceful error handling with backoff strategies
- Creates log file/directory if missing

**Thread Management** (L199-209):
- `start()`: Spawns daemon thread for watching
- `stop()`: Graceful shutdown with 2s timeout

**Utilities** (L211-228):
- `inject_event()`: Manual event injection for testing
- `clear_position()`: Reset position tracking

## Dependencies
- `json`, `threading`: Core functionality
- `pathlib.Path`: File system operations  
- `datetime`: Timestamp formatting
- `os.stat()`: File rotation detection via inodes

## Key Patterns
- **Event-driven architecture**: Callback registration system for different event types
- **Robust file handling**: Handles rotation, deletion, partial reads, encoding issues
- **State persistence**: Resume capability via position file
- **Graceful degradation**: Continues operation despite individual errors
- **Thread safety**: Daemon thread with controlled shutdown

## Critical Invariants
- Only processes JSON lines with `message` field matching registered callbacks
- Maintains file position accuracy for reliable resume
- Inode tracking prevents duplicate processing after rotation
- Callback errors don't interrupt main watching loop

## Example Usage (L232-249)
Demonstrates basic setup: creates watcher, registers event callbacks, starts monitoring with keyboard interrupt handling.
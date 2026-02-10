# examples/visualizer/log_watcher.py
@source-hash: 577536bf710e4b2c
@generated: 2026-02-10T00:41:45Z

## Purpose
Real-time log file watcher for MCP debugger events. Tails log files, parses JSON events, and dispatches them to registered callbacks for visualization components.

## Core Classes

### LogWatcher (L18-228)
Main class that monitors log files using polling with position tracking and file rotation detection.

**Key State:**
- `log_path` (L29): Target log file path
- `position` (L31): Current file read position
- `callbacks` (L33): Event type → callback function mapping
- `running` (L32): Thread control flag
- `_position_file` (L36): Persistent position storage for resume capability

**Key Methods:**
- `__init__(log_path, polling_interval=0.1)` (L21-37): Sets up file path and polling rate
- `on_event(event_type, callback)` (L38-46): Registers callbacks for specific message types
- `parse_log_line(line)` (L48-79): JSON parsing with structured event filtering
- `watch()` (L111-198): Main monitoring loop with file rotation and position management
- `start()` (L199-203): Spawns daemon thread for background watching
- `stop()` (L205-209): Clean shutdown with thread join

## Key Features

**File Rotation Handling (L126-135, L178-182):**
- Tracks file inode to detect rotation
- Resets position when file is rotated
- Gracefully handles file deletion/recreation

**Position Persistence (L94-109):**
- Saves/loads read position to `.visualizer_position`
- Enables resume after restart without re-processing old events
- Silent error handling for position file operations

**Robust Parsing (L58-79):**
- Filters for JSON lines starting with '{'
- Only processes events with 'message' field matching registered callbacks
- Converts numeric timestamps to readable format (L68-71)
- Graceful JSON error handling

**Threading Model (L199-209):**
- Uses daemon threads for non-blocking operation
- Proper cleanup with timeout join
- Thread safety through single-writer design

## Dependencies
- Standard library: `json`, `time`, `os`, `threading`, `datetime`, `pathlib`
- No external dependencies

## Event Flow
1. Register callbacks with `on_event()` for specific message types
2. Start background monitoring with `start()`
3. Continuously polls file for new lines
4. Parses JSON and filters by registered message types
5. Dispatches matching events to callbacks
6. Maintains position for resume capability

## Usage Pattern
Designed for MCP debugger visualization - expects structured JSON log events with 'message' field indicating event type (e.g., 'tool:call', 'session:created').
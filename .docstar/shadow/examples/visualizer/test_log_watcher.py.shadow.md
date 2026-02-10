# examples/visualizer/test_log_watcher.py
@source-hash: 60a2e6cc5c70d6d1
@generated: 2026-02-09T18:15:02Z

## Test Script for Log Watcher Functionality

**Primary Purpose:** Comprehensive test script that validates `LogWatcher` functionality through automated testing of event detection, parsing, error handling, and position persistence.

### Key Functions

**`create_test_event(message_type, **kwargs)` (L22-32)**
- Factory function for generating structured test events
- Creates events with timestamp, level, namespace, and message fields
- **Bug Alert:** Duplicate "timestamp" field assignment (L25 ISO format, L29 epoch millis)

**`main()` (L35-187)**
- Main test orchestrator that executes comprehensive test suite
- Creates temporary log file `test_watcher.log` (L38)
- Tests multiple scenarios: normal events, partial lines, malformed JSON, position persistence

**`event_handler()` (L55-58)**
- Local callback function that captures received events for validation
- Appends events to `received_events` list for counting and verification

### Test Scenarios Covered

1. **Normal Event Processing** (L71-118): Tests 5 event types (session:created, tool:call, tool:response, debug:state, debug:variables)
2. **Partial Line Handling** (L119-136): Writes incomplete JSON line, then completes it
3. **Malformed JSON Handling** (L138-146): Tests error resilience with non-JSON input
4. **Position Persistence** (L155-180): Validates file position tracking across watcher restarts

### Dependencies
- `LogWatcher` from `examples.visualizer.log_watcher` (L19)
- Standard library: `json`, `time`, `sys`, `pathlib`, `datetime`
- Path manipulation for parent directory access (L17)

### Architecture Notes
- Uses event-driven pattern with callback registration (L61-63)
- Implements proper resource cleanup (L184-185)
- File I/O with explicit flushing for reliable testing (L114, L125, L134)
- Sleep delays for watcher processing synchronization

### Test Event Structure
Events follow consistent schema with fields: timestamp, level, namespace, message, plus event-specific data like sessionId, tool names, debug state information.

### Critical Constraints
- Requires `LogWatcher` class to be functional and importable
- Creates temporary files in current directory
- Synchronization depends on fixed sleep intervals
- Position persistence requires writable filesystem for state storage
# examples/visualizer/test_log_watcher.py
@source-hash: 1ff986d7f62d70cf
@generated: 2026-02-10T01:18:59Z

## Primary Purpose
Test script that validates the LogWatcher functionality by creating a temporary log file, writing various debug events to it, and verifying that the watcher correctly detects, parses, and handles them. Serves as both a demonstration and integration test for the log watching system.

## Key Components

**create_test_event() (L22-31)**: Factory function that creates standardized test events with timestamp, level, namespace, and message fields. Accepts additional kwargs to customize event properties for different test scenarios.

**main() (L34-186)**: Primary test orchestrator that:
- Creates temporary log file `test_watcher.log` (L37-41)
- Instantiates LogWatcher and registers event handlers (L49-62)
- Tests core functionality with 5 predefined event types (L70-104)
- Validates partial line handling and malformed JSON resilience (L119-145)
- Tests position persistence across watcher restarts (L155-179)
- Performs cleanup operations (L182-185)

**event_handler() (L54-57)**: Local callback function that tracks received events and provides console output for test verification.

## Test Scenarios Covered

1. **Normal Event Processing**: Tests session creation, tool calls/responses, debug state changes, and variable updates
2. **Partial Line Handling**: Writes incomplete JSON, then completes it to test buffering behavior
3. **Error Resilience**: Writes malformed JSON to verify graceful error handling
4. **Position Persistence**: Stops/restarts watcher to ensure file position is maintained across sessions

## Dependencies
- `LogWatcher` from `examples.visualizer.log_watcher` (L19)
- Standard library: `json`, `time`, `sys`, `pathlib`, `datetime`
- Uses sys.path modification for import resolution (L17)

## Key Event Types Tested
- `session:created`: Debug session initialization
- `tool:call`/`tool:response`: Tool invocation pairs  
- `debug:state`: Debugger state transitions
- `debug:variables`: Variable inspection data

## Test Data Structure
Events follow consistent schema with timestamp, level, namespace, message fields plus event-specific data. All timestamps use millisecond precision Unix time.
# tests/test-utils/python-environment.ts
@source-hash: c463912123cd93e2
@generated: 2026-02-10T00:41:58Z

## Purpose
Test utility module for detecting Python runtime environment availability. Provides async functions to check if Python interpreter and debugpy module are accessible in the current system environment.

## Key Functions

### isPythonAvailable() (L9-54)
- **Purpose**: Detects if any Python interpreter is available on the system
- **Strategy**: Tries multiple common Python commands (`python`, `python3`, `py`) sequentially
- **Detection Method**: Spawns `--version` subprocess for each command, validates both exit code (0) and output presence
- **Timeout**: 2-second timeout per command attempt (L39-42)
- **Returns**: `Promise<boolean>` - true if any Python command succeeds

### isDebugpyAvailable() (L59-106)  
- **Purpose**: Checks if Python debugpy module is installed and importable
- **Dependency**: First calls `isPythonAvailable()` as prerequisite (L60-62)
- **Detection Method**: Executes Python import statement `import debugpy; print("OK")` and validates "OK" output
- **Timeout**: 3-second timeout per command attempt (L91-94)
- **Returns**: `Promise<boolean>` - true if debugpy import succeeds

## Implementation Patterns

### Process Management
- Uses `child_process.spawn()` with shell execution for cross-platform compatibility
- Implements proper event handling for `stdout`, `stderr`, `close`, and `error` events
- Includes timeout mechanisms to prevent hanging processes
- Graceful error handling with try-catch blocks around Promise-based subprocess calls

### Command Fallback Strategy
- Both functions iterate through standard Python command variants
- Early return on first successful detection
- Silent failure progression through command list

## Dependencies
- Node.js `child_process` module for subprocess spawning
- No external npm dependencies

## Cross-Platform Considerations
- Uses `shell: true` option for Windows compatibility with command resolution
- Tests multiple Python executable names common across different OS environments
# tests/test-utils/python-environment.ts
@source-hash: c463912123cd93e2
@generated: 2026-02-09T18:15:09Z

## Purpose
Test utility module for detecting Python environment capabilities. Provides async functions to check for Python interpreter availability and specific package installations in test environments.

## Key Functions

### `isPythonAvailable()` (L9-54)
- **Purpose**: Detects if any Python interpreter is available on the system
- **Strategy**: Tests multiple common Python command variants (`python`, `python3`, `py`) sequentially
- **Implementation**: Spawns child processes with `--version` flag, validates both exit code (0) and output presence
- **Timeout**: 2-second timeout per command attempt with process cleanup
- **Returns**: `Promise<boolean>` - true if any Python command succeeds

### `isDebugpyAvailable()` (L59-106)
- **Purpose**: Checks if the `debugpy` Python package is installed and importable
- **Dependencies**: Calls `isPythonAvailable()` first as prerequisite check
- **Strategy**: Executes Python import test (`import debugpy; print("OK")`) across command variants
- **Validation**: Requires both zero exit code and "OK" string in stdout output
- **Timeout**: 3-second timeout per command attempt
- **Returns**: `Promise<boolean>` - true if debugpy can be imported

## Architecture Patterns
- **Error Resilience**: Both functions use try-catch blocks and continue-on-failure patterns
- **Command Fallbacks**: Systematic testing of multiple Python command variants for cross-platform compatibility
- **Process Management**: Proper cleanup with timeouts and error handlers for spawned processes
- **Async/Promise Wrapping**: Child process operations wrapped in Promise-based APIs

## Dependencies
- `child_process.spawn`: For executing Python commands
- Shell execution enabled for cross-platform compatibility

## Critical Constraints
- Hard-coded timeouts (2s/3s) may need adjustment for slower systems
- Assumes shell availability for command execution
- Requires stdout/stderr output validation beyond just exit codes
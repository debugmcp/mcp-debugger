# tests/manual/test_debugpy_launch.ts
@source-hash: f3d9c27a877a3888
@generated: 2026-02-10T01:18:55Z

## Purpose
Manual test script for launching and observing a debugpy adapter process. Validates debugpy.adapter module execution with proper configuration, logging, and process lifecycle management.

## Key Functions

### testLaunch() (L6-89)
Main test function that:
- Sets up debugpy adapter configuration with hardcoded Windows Python path (L9)
- Creates log directory in temp folder with session-based naming (L15-21)
- Spawns debugpy.adapter subprocess with host/port/log-dir arguments (L35-38)
- Monitors process stdout/stderr streams and lifecycle events (L56-74)
- Runs for 30-second observation period before cleanup (L78)
- Terminates adapter process with SIGTERM signal (L82)

## Configuration
- **Python Path**: Hardcoded to `C:\Python313\python.exe` (L9)
- **Network**: Binds to localhost:5678 (L10-11)
- **Logging**: Uses temp directory with test-session prefix (L12, L15)
- **Process Options**: Attached mode with piped stdio (L36-37)

## Process Management
- Comprehensive error handling for spawn failures (L39-52)
- Event listeners for stdout/stderr data streams (L56-62)
- Process lifecycle monitoring (error, exit, close events) (L64-74)
- Graceful termination with fallback error handling (L80-88)

## Dependencies
- Node.js child_process for subprocess management
- fs-extra for directory operations
- Standard path/os modules for file system utilities

## Architecture Notes
- Designed as standalone manual test (executed via direct function call L91)
- Uses async/await pattern with Promise-based delays
- Implements defensive programming with null checks and error boundaries
- Mimics production PythonDebugger log directory setup pattern
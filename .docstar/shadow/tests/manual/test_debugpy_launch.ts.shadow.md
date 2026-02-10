# tests/manual/test_debugpy_launch.ts
@source-hash: 493d4e0c96e09267
@generated: 2026-02-09T18:15:12Z

**Primary Purpose**: Manual integration test script for verifying debugpy adapter process spawning and lifecycle management.

**Core Functionality**:
- Tests the ability to spawn a Python debugpy adapter as a child process (L36-43)
- Monitors adapter process output streams and lifecycle events (L57-75) 
- Provides a controlled test environment with cleanup (L77-90)

**Key Function**:
- `testLaunch()` (L6-90): Main test orchestrator that handles the complete adapter lifecycle from spawn to termination

**Configuration & Dependencies**:
- Hardcoded Python path: `C:\Python313\python.exe` (L9)
- Uses localhost:5678 for adapter binding (L10-11)
- Creates temporary log directory using `fs-extra` (L14-22)
- Spawns adapter with args: `-m debugpy.adapter --host --port --log-dir` (L24-29)

**Process Management Pattern**:
- Spawns with piped stdio for output capture (L36-39)
- Implements comprehensive event handling for stdout/stderr/error/exit/close events (L57-75)
- Uses graceful termination with SIGTERM after 30-second observation period (L81-89)

**Error Handling**:
- Validates spawn success and PID assignment (L45-53)
- Provides detailed spawn failure diagnostics including spawnfile/spawnargs inspection (L49-51)
- Handles directory creation failures with non-fatal logging (L19-22)

**Test Structure**:
- Fixed 30-second runtime for observation (L78-79)
- Automatic cleanup with process termination
- Console logging for all major events and state changes

**Architectural Notes**:
- Designed as a standalone manual test (not automated test suite)
- Mimics production debugger adapter spawning patterns
- Uses detached:false to maintain parent-child relationship
# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/asyncio/subprocess.py
@source-hash: 7b70605716334f63
@generated: 2026-02-09T18:06:14Z

## Purpose
Asyncio subprocess module providing high-level async process creation and communication via `create_subprocess_exec` and `create_subprocess_shell` functions. Implements stream-based I/O for subprocess pipes using asyncio's transport/protocol pattern.

## Key Components

### Constants (L12-14)
- `PIPE`, `STDOUT`, `DEVNULL`: Re-exported from standard subprocess module for convenience

### SubprocessStreamProtocol (L17-116)
Core protocol class implementing asyncio's SubprocessProtocol interface with stream support:
- **Initialization (L21-28)**: Sets up stream limit, creates stdin close future, initializes pipe tracking
- **Connection Management (L40-63)**: Creates StreamReader/StreamWriter instances for stdout/stderr/stdin pipes based on available transports
- **Data Handling (L64-72)**: Routes pipe data to appropriate StreamReader (fd 1→stdout, fd 2→stderr)
- **Connection Loss (L74-102)**: Handles pipe closure, manages EOF/exceptions, tracks pipe state via `_pipe_fds`
- **Transport Lifecycle (L104-111)**: Closes transport when all pipes closed and process exited

### Process (L118-203)
High-level process wrapper providing async interface:
- **Attributes**: Direct access to stdin/stdout/stderr streams, pid, and returncode property (L131-133)
- **Process Control (L139-146)**: Signal sending, termination, and killing methods
- **Communication (L188-203)**: `communicate()` method for full I/O interaction - sends input to stdin, reads all output from stdout/stderr concurrently
- **Stream Helpers (L148-186)**: Internal methods for feeding stdin and reading output streams with debug logging

### Factory Functions
- **create_subprocess_shell (L206-215)**: Creates subprocess from shell command string
- **create_subprocess_exec (L218-229)**: Creates subprocess from program path and arguments

## Architecture
Uses asyncio's transport/protocol pattern where:
1. Protocol handles low-level pipe events and stream creation
2. Process class provides high-level async API
3. Factory functions orchestrate protocol creation and event loop integration

## Key Relationships
- Depends on `streams`, `protocols`, `events`, `tasks` from asyncio
- Integrates with event loop's `subprocess_shell`/`subprocess_exec` methods
- Uses `StreamReader`/`StreamWriter` for async I/O operations

## Critical Behavior
- Automatic transport closure when all pipes closed and process exits (L108-111)
- Exception handling in `communicate()` ignores `BrokenPipeError`/`ConnectionResetError` (L158-162)
- Debug logging throughout communication operations when loop debug enabled
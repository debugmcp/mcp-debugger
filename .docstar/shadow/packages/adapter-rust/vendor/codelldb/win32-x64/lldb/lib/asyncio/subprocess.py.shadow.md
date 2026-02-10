# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/subprocess.py
@source-hash: 7b70605716334f63
@generated: 2026-02-09T18:12:21Z

## Purpose and Responsibility
Provides high-level asyncio interface for creating and managing subprocesses with stream-based I/O handling. Wraps asyncio's lower-level subprocess transport/protocol system into convenient async functions and Process objects.

## Key Components

### SubprocessStreamProtocol (L17-116)
Core protocol that bridges asyncio subprocess transport with stream-based I/O:
- **Initialization (L21-28)**: Sets up stream readers/writers with flow control limits and tracks pipe state
- **Connection Management (L40-63)**: Creates StreamReader for stdout/stderr and StreamWriter for stdin when pipes are available
- **Data Handling (L64-72)**: Routes received pipe data to appropriate stream readers based on file descriptor
- **Connection Cleanup (L74-102)**: Manages pipe closure, EOF handling, and transport lifecycle
- **Transport Lifecycle (L108-111)**: Automatically closes transport when all pipes are closed and process has exited

### Process (L118-203)
High-level process wrapper providing convenient async interface:
- **Properties**: Exposes stdin/stdout/stderr streams, PID, and return code
- **Process Control (L139-146)**: Signal sending, termination, and kill methods
- **Stream Communication (L148-186)**: Internal methods for feeding stdin and reading stdout/stderr
- **communicate() (L188-203)**: Main async method that handles bidirectional communication - sends input to stdin while concurrently reading from stdout/stderr

### Factory Functions
- **create_subprocess_shell() (L206-215)**: Creates subprocess from shell command string
- **create_subprocess_exec() (L218-229)**: Creates subprocess from program path and arguments

## Key Dependencies
- `streams`: Provides StreamReader/StreamWriter and flow control
- `protocols.SubprocessProtocol`: Base protocol for subprocess communication
- `events.get_running_loop()`: Retrieves current event loop
- `tasks.gather()`: Concurrent execution of I/O operations

## Architecture Patterns
- **Protocol/Transport Pattern**: Uses asyncio's separation of protocol logic from transport implementation
- **Stream Abstraction**: Converts low-level pipe file descriptors into high-level async streams
- **Graceful Cleanup**: Tracks pipe and process state to ensure proper resource cleanup
- **Concurrent I/O**: Uses gather() to simultaneously handle stdin writing and stdout/stderr reading

## Critical Behavior
- Transport is only closed when both all pipes are closed AND process has exited
- communicate() waits for process completion after I/O operations finish
- BrokenPipeError and ConnectionResetError are silently ignored during stdin feeding
- Supports standard subprocess redirection constants (PIPE, STDOUT, DEVNULL)
# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/multiprocessing/popen_fork.py
@source-hash: 0a09db57e7fab706
@generated: 2026-02-09T18:11:14Z

## Purpose
Fork-based process spawning implementation for Python's multiprocessing library on Unix-like systems. Provides a `Popen` class that uses `os.fork()` to create child processes, serving as a platform-specific backend for multiprocessing operations.

## Key Classes & Functions

**Popen (L12-83)**: Main process spawning class using fork method
- `method = 'fork'` (L13): Class identifier for fork-based spawning
- `__init__(process_obj)` (L15-19): Initializes process launch, flushes streams, calls `_launch()`
- `duplicate_for_child(fd)` (L21-22): No-op for fork (file descriptors inherited naturally)
- `poll(flag=os.WNOHANG)` (L24-34): Non-blocking process status check using `os.waitpid()`
- `wait(timeout=None)` (L36-44): Blocking wait with optional timeout using connection sentinels
- `_send_signal(sig)` (L46-54): Signal delivery with error handling for dead processes
- `terminate()` (L56-57): Sends SIGTERM signal
- `kill()` (L59-60): Sends SIGKILL signal
- `_launch(process_obj)` (L62-79): Core fork logic with parent/child process separation
- `close()` (L81-83): Cleanup via finalizer

## Dependencies
- `os`: System calls (fork, pipe, waitpid, kill, close, _exit)
- `signal`: Signal constants (SIGTERM, SIGKILL)
- `util`: Internal utilities (flush streams, finalize, close file descriptors)
- `multiprocessing.connection.wait`: Timeout handling (imported conditionally L39)

## Architecture Patterns
- **Fork-exec pattern**: Creates child via `os.fork()`, child calls `process_obj._bootstrap()`
- **Pipe-based communication**: Parent-child coordination using `os.pipe()` pairs (L64-65)
- **Sentinel-based synchronization**: Parent monitors child via readable pipe end (L79)
- **Resource cleanup**: Finalizer pattern ensures file descriptor cleanup (L77-78)

## Critical Invariants
- Child process always calls `os._exit()` to prevent resource issues (L73)
- Parent closes child-side pipe ends immediately after fork (L75-76)
- Signal sending is resilient to race conditions (process death during signal delivery)
- Only works on Unix-like systems (depends on `os.fork()`)

## Process Flow
1. `_launch()` creates communication pipes and forks
2. Child process executes `process_obj._bootstrap()` and exits via `os._exit()`
3. Parent monitors child via sentinel pipe and manages lifecycle
4. Status polling uses `os.waitpid()` with proper error handling for timing issues
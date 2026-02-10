# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/multiprocessing/popen_forkserver.py
@source-hash: 0588ad0e5a36718b
@generated: 2026-02-09T18:11:10Z

## Purpose
Process spawning implementation using forkserver method for Python multiprocessing. Part of the LLDB debugger's vendored Python multiprocessing module, providing cross-platform process creation capabilities on Win32-x64.

## Key Components

### _DupFd Class (L19-24)
Wrapper for file descriptors used during process launch. Stores an index (`ind`) and provides `detach()` method that retrieves the actual fd from forkserver's inherited file descriptors.

### Popen Class (L29-73)
Main process spawning class inheriting from `popen_fork.Popen`. Implements forkserver-based process creation:
- `method = 'forkserver'` - identifies spawning method
- `DupFd = _DupFd` - associates fd wrapper class
- `__init__(process_obj)` (L33-35) - initializes with empty fd list
- `duplicate_for_child(fd)` (L37-39) - tracks file descriptors for child process
- `_launch(process_obj)` (L41-59) - core launch logic using forkserver communication
- `poll(flag)` (L61-73) - checks process status with optional blocking

## Dependencies
- `forkserver` - server process management
- `popen_fork` - base Popen implementation
- `spawn` - process preparation utilities  
- `reduction` - object serialization (requires HAVE_SEND_HANDLE support)
- `context` - spawning context management
- `util` - cleanup utilities

## Architecture
Uses forkserver pattern where a dedicated server process forks children. Process data is serialized via `reduction.dump()` and sent through pipes. Child process status is monitored via sentinel file descriptors.

## Critical Constraints
- Requires `reduction.HAVE_SEND_HANDLE` capability (L5-6)
- File descriptor management through `_fds` list tracking
- Cleanup handled via `util.Finalize` for parent write descriptor and sentinel
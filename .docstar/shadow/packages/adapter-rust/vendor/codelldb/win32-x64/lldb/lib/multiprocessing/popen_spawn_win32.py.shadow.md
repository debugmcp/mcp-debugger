# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/multiprocessing/popen_spawn_win32.py
@source-hash: 6ef8efd9cd4e99c6
@generated: 2026-02-09T18:11:13Z

## Purpose
Windows-specific process spawning implementation for the multiprocessing module. Provides a `Popen` class that creates and manages child processes using Win32 APIs, specifically designed for spawning Python multiprocessing worker processes on Windows platforms.

## Key Components

### Popen Class (L39-145)
Main process management class that wraps Win32 process creation and control:

- **`__init__(process_obj)` (L45-97)**: Creates new process using `_winapi.CreateProcess`, sets up inter-process communication pipe, handles virtual environment launcher detection, and serializes process data to child
- **`wait(timeout=None)` (L103-119)**: Blocks until process terminates or timeout expires, using `_winapi.WaitForSingleObject`
- **`poll()` (L121-122)**: Non-blocking process status check (calls `wait` with timeout=0)
- **`terminate()` (L124-141)**: Forcefully terminates process using `_winapi.TerminateProcess` with custom exit code
- **`duplicate_for_child(handle)` (L99-101)**: Duplicates handles for child process inheritance
- **`close()` (L144-145)**: Cleanup method that invokes finalizer

### Module Constants (L17-26)
- **`TERMINATE = 0x10000`**: Custom exit code for terminated processes
- **`WINEXE`**: Detects if running as frozen executable
- **`WINSERVICE`**: Detects if running as Windows service
- **`WINENV`**: Detects virtual environment usage

### Utility Functions
- **`_close_handles(*handles)` (L29-31)**: Cleanup function for Win32 handles
- **`_path_eq(p1, p2)` (L23-24)**: Case-insensitive path comparison for Windows

## Dependencies
- **Internal**: `.context`, `.spawn`, `.util` modules for multiprocessing infrastructure
- **External**: `_winapi` for low-level Windows process/handle APIs, `msvcrt` for file descriptor operations

## Architecture Patterns
- **Process Spawning**: Uses Win32 `CreateProcess` rather than fork/exec model
- **IPC Setup**: Creates named pipe for parent-child communication before process creation
- **Handle Management**: Implements proper Win32 handle lifecycle with finalizers
- **Virtual Environment Handling**: Special logic to bypass venv redirects and use base Python executable

## Critical Invariants
- Process must be created with pipe handle for communication
- Handles must be properly closed to prevent resource leaks
- Return codes are only set after confirmed process termination via `WaitForSingleObject`
- Child process data serialization must complete before parent continues
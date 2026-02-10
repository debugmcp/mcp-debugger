# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/multiprocessing/spawn.py
@source-hash: ebf9fa40eb622384
@generated: 2026-02-09T18:11:20Z

## Purpose
Core module for spawning new Python processes in multiprocessing when using 'spawn' or 'forkserver' start methods. Handles cross-platform process creation, executable configuration, and subprocess preparation/initialization.

## Key Components

### Executable Management
- `set_executable(exe)` (L36-43): Sets Python executable path with platform-specific encoding
- `get_executable()` (L45-46): Returns current Python executable path
- Platform detection constants `WINEXE`, `WINSERVICE` (L29-34) for Windows-specific behavior
- Global `_python_exe` variable holds executable path

### Process Spawning Detection
- `is_forking(argv)` (L57-64): Detects if current process is a spawned child via `--multiprocessing-fork` flag
- `freeze_support()` (L67-80): Entry point for spawned processes, parses command line arguments and calls `spawn_main()`

### Command Line Generation
- `get_command_line(**kwds)` (L83-95): Constructs command line for spawning child processes
  - Frozen executables: uses direct executable call
  - Normal Python: uses `-c` flag with spawn_main import
  - Includes interpreter flags via `util._args_from_interpreter_flags()`

### Child Process Initialization
- `spawn_main(pipe_handle, parent_pid, tracker_fd)` (L98-123): Main entry for spawned child processes
  - Platform-specific pipe handling (Windows vs Unix)
  - Sets up communication channels and resource tracking
  - Calls `_main()` for actual process bootstrap
- `_main(fd, parent_sentinel)` (L126-135): Core bootstrap logic
  - Reads pickled preparation data and process object from parent
  - Sets `_inheriting` flag during unpickling
  - Calls process `_bootstrap()` method

### Process Preparation
- `get_preparation_data(name)` (L160-204): Collects parent process state for child initialization
  - Logging configuration, authentication keys
  - System path and argv
  - Working directory and original directory
  - Main module initialization strategy (by name or path)
- `prepare(data)` (L212-246): Applies preparation data in child process
  - Restores process name, authkey, logging, paths
  - Handles main module fixup via `_fixup_main_from_name/path()`

### Main Module Fixup
- `_fixup_main_from_name(mod_name)` (L250-272): Re-initializes `__main__` from module name
  - Creates `__mp_main__` module to avoid code re-execution issues
  - Uses `runpy.run_module()` for proper module loading
- `_fixup_main_from_path(main_path)` (L275-300): Re-initializes `__main__` from file path
  - Special handling for IPython launcher scripts
  - Uses `runpy.run_path()` for script execution
- `old_main_modules` (L210): Global list preserving original main modules
- `import_main_path(main_path)` (L303-307): Public API for main module setup

### Safety Checks
- `_check_not_importing_main()` (L138-157): Prevents unsafe main module imports during child process initialization
  - Checks `_inheriting` flag on current process
  - Provides detailed error message with fix instructions

## Dependencies
- `os`, `sys`, `runpy`, `types`: Standard library modules
- `.process`: Process objects and current process management
- `.context.reduction`: Pickle-based object serialization
- `.util`: Utility functions for logging and interpreter flags
- Platform-specific: `msvcrt`, `_winapi` (Windows), `resource_tracker` (Unix)

## Architecture Notes
- Supports both frozen executables and normal Python interpreters
- Platform-aware pipe/handle management for IPC
- Careful main module handling to prevent code re-execution in child processes
- Uses pickling for cross-process data transfer and process object reconstruction
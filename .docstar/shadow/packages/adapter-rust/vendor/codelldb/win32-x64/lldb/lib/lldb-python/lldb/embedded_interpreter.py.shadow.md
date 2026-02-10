# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/lldb-python/lldb/embedded_interpreter.py
@source-hash: ab896ce68f2461e5
@generated: 2026-02-09T18:06:10Z

## Purpose
Provides Python interpreter integration for LLDB debugger, supporting both interactive and single-command execution modes with terminal-aware input handling.

## Key Components

### Input/Output Functions
- `readfunc()` (L56-58): Standard input reader with exit command detection
- `readfunc_stdio()` (L61-69): Alternative input reader using direct stdin/stdout for non-terminal environments
- `strip_and_check_exit()` (L49-53): Processes input lines and raises LLDBExit on "exit"/"quit" commands

### Terminal Management
- `get_terminal_size()` (L33-42): Unix-specific terminal size detection using fcntl/termios
- Terminal echo control logic (L77-98): Automatically disables/restores terminal echoing in zero-width terminals

### Execution Modes
- `run_python_interpreter()` (L72-116): Interactive REPL with terminal detection and echo management
- `run_one_line()` (L119-136): Single command execution with optional global string fallback

### Exception Handling
- `LLDBExit` (L45-46): Custom exception for clean interpreter termination
- Unified SystemExit handling with exit code reporting (L114-116, L134-136)

## Architecture Decisions

### Cross-Platform Compatibility
- Python 2/3 compatibility via version detection (L3-6)
- Graceful readline feature detection with Linux-specific AttributeError handling (L11-25)
- Platform-specific readline configuration for libedit vs GNU readline (L22-25)

### Terminal Awareness
- Smart terminal detection using width measurement (L77)
- Automatic echo control for pseudo-terminals
- Fallback input methods for different terminal types

### Global State Management
- `g_run_one_line_str` (L30): Global variable for alternative command storage when direct string passing is problematic

## Dependencies
- `lldb`: Core LLDB Python bindings
- `code`: Python REPL infrastructure
- `readline`/`rlcompleter`: Optional tab completion (gracefully degraded)
- `termios`/`fcntl`: Unix terminal control (with exception handling)

## Usage Patterns
Designed for embedding within LLDB's Python command interface, providing seamless Python execution with debugger context preservation through `local_dict` parameter threading.
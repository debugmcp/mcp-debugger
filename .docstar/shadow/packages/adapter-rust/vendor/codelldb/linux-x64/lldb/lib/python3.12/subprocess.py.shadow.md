# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/subprocess.py
@source-hash: baa9f9138d8d20df
@generated: 2026-02-09T18:10:15Z

## Purpose
Python's standard subprocess module providing cross-platform process creation and management. Enables spawning processes, connecting to I/O streams, and obtaining return codes. Part of LLDB's vendored Python distribution for codelldb adapter.

## Core API Classes and Functions

### Main Classes
- **Popen (L749-2216)**: Primary class for flexible process execution with comprehensive I/O handling
- **CompletedProcess (L470-504)**: Immutable result object returned by `run()` with args, returncode, stdout, stderr
- **SubprocessError (L123)**: Base exception class for subprocess-related errors
- **CalledProcessError (L126-161)**: Exception raised when process returns non-zero exit code
- **TimeoutExpired (L163-189)**: Exception raised when process timeout expires

### High-Level Functions
- **run() (L506-573)**: Modern API - executes command and returns CompletedProcess
- **call() (L381-395)**: Legacy API - executes command, returns exit code
- **check_call() (L398-414)**: Like call() but raises CalledProcessError on non-zero exit
- **check_output() (L417-467)**: Returns stdout, raises on non-zero exit
- **getstatusoutput() (L649-679)**: Shell command execution returning (exitcode, output) tuple
- **getoutput() (L681-691)**: Shell command execution returning only output

## Platform Detection and Adaptation
- **_mswindows (L70-75)**: Boolean flag detecting Windows via msvcrt import
- **_can_fork_exec (L78)**: Capability check for WASM platforms (emscripten, wasi)
- **Windows-specific imports (L80-101)**: WinAPI constants and handles when on Windows
- **POSIX imports (L103-120)**: Unix-specific modules and selectors

## Constants and Special Values
- **PIPE (-1), STDOUT (-2), DEVNULL (-3) (L281-283)**: Special redirection constants
- **Process control globals (L745-746)**: _USE_POSIX_SPAWN, _USE_VFORK capability flags

## Core Implementation Details

### Popen Constructor (L807-1062)
Comprehensive process setup with parameter validation, I/O pipe creation, and platform-specific execution paths. Handles text/binary modes, buffer sizes, and security contexts.

### Platform-Specific Execution
- **Windows _execute_child() (L1436-1561)**: Uses CreateProcess with STARTUPINFO
- **POSIX _execute_child() (L1791-1958)**: Uses fork/exec or posix_spawn with error pipe communication
- **_posix_spawn() (L1752-1789)**: Modern POSIX spawn implementation with file actions

### I/O and Communication
- **communicate() (L1165-1230)**: Bidirectional I/O with timeout support
- **Windows _communicate() (L1603-1651)**: Thread-based I/O using reader threads
- **POSIX _communicate() (L2062-2161)**: Selector-based non-blocking I/O

### Process Lifecycle Management
- **_cleanup() (L259-279)**: Zombie process cleanup for POSIX systems
- **_internal_poll() (L1563-1577, L1973-2005)**: Platform-specific status checking
- **wait() (L1259-1280, L2021-2059)**: Process termination waiting with timeout

## Text Processing and Encoding
- **_text_encoding() (L361-378)**: Default encoding detection with warning system
- **_translate_newlines() (L1085-1087)**: Cross-platform newline normalization
- **list2cmdline() (L576-643)**: Windows command-line escaping following MS C runtime rules

## Architecture Notes
- Extensive platform abstraction with Windows/POSIX code paths
- Thread-safe design using _waitpid_lock for concurrent operations
- Memory-efficient I/O using selectors and memoryview objects
- Robust error handling with subprocess-specific exception hierarchy
- Process cleanup mechanisms to prevent zombie processes

## Dependencies
- Standard library: os, sys, signal, threading, io, select, selectors
- Platform modules: _winapi (Windows), fcntl (POSIX), _posixsubprocess
- Optional: msvcrt, pwd, grp for extended functionality
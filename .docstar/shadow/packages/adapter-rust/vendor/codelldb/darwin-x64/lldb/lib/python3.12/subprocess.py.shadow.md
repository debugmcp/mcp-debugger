# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/subprocess.py
@source-hash: baa9f9138d8d20df
@generated: 2026-02-09T18:08:23Z

## Primary Purpose
Cross-platform Python subprocess module providing process spawning, I/O redirection, and process management. Part of LLDB's Python distribution for macOS x64 systems. Implements PEP 324 subprocess interface with Windows and POSIX platform abstractions.

## Key Classes and Functions

### Exception Classes
- **SubprocessError** (L123): Base exception class for subprocess-related errors
- **CalledProcessError** (L126-161): Raised when process returns non-zero exit code with check=True. Contains returncode, cmd, output, stderr attributes. Property stdout aliases output attribute
- **TimeoutExpired** (L163-189): Raised when process timeout expires. Contains cmd, timeout, output, stderr attributes with stdout property alias

### Windows-Specific Classes  
- **STARTUPINFO** (L192-213): Windows process startup configuration with handle management and copy() method
- **Handle** (L215-232): Windows handle wrapper with Close/Detach methods and automatic cleanup via __del__

### Core Process Management
- **Popen** (L749-2216): Main process execution class with platform-specific implementations
  - **__init__** (L807-1062): Process initialization with extensive parameter validation, pipe setup, and cross-platform compatibility checks
  - **communicate** (L1165-1230): Bidirectional I/O with timeout support, handles KeyboardInterrupt gracefully
  - **wait** (L1259-1280): Process completion waiting with timeout and signal handling
  - **poll** (L1233-1236): Non-blocking process status check
  - **terminate/kill** (L1667-1682, L2208-2216): Process termination methods (platform-specific)

### High-Level API Functions
- **run** (L506-573): Modern high-level interface returning CompletedProcess, handles timeouts and checking
- **call** (L381-395): Legacy interface returning exit code only
- **check_call** (L398-414): call() variant that raises on non-zero exit
- **check_output** (L417-467): Returns stdout bytes/string, raises on error
- **getstatusoutput/getoutput** (L649-691): Shell command execution utilities

### Utility Functions
- **CompletedProcess** (L470-504): Return value container for run() with args, returncode, stdout, stderr
- **list2cmdline** (L576-643): Windows command-line argument escaping following MS C runtime rules
- **_use_posix_spawn** (L695-740): Platform capability detection for optimized process spawning

## Platform Abstractions

### Windows Implementation (L331-1683)
- **_get_handles** (L1335-1411): Windows handle creation and inheritance setup
- **_execute_child** (L1436-1561): CreateProcess API wrapper with handle management
- **_communicate** (L1603-1651): Thread-based I/O using _readerthread helper
- Uses _winapi module for low-level Windows process/handle operations

### POSIX Implementation (L1684-2216)  
- **_get_handles** (L1688-1749): Unix pipe/fd setup with fcntl pipe sizing
- **_posix_spawn** (L1752-1789): Modern posix_spawn() optimization path
- **_execute_child** (L1791-1958): fork/exec implementation with comprehensive error propagation via error pipe
- **_communicate** (L2062-2161): select/poll-based I/O multiplexing with _PopenSelector

## Key Dependencies
- **Platform detection**: msvcrt presence determines Windows vs POSIX behavior (L70-76)
- **Process capabilities**: _can_fork_exec flag excludes WASM platforms (L78)
- **Optional modules**: fcntl (L57-60), grp/pwd for user/group handling
- **Threading**: Used for Windows I/O and process cleanup management
- **Selectors**: POSIX I/O multiplexing via PollSelector/SelectSelector (L242-245)

## Critical Invariants
- Process cleanup via _active list prevents zombie processes on POSIX (L266-279)
- Thread-safe waitpid operations via _waitpid_lock (L828)
- Proper handle/fd closure on errors via context managers (L1311-1329)
- Signal handling during KeyboardInterrupt with configurable timeout (L882, L1109-1115)

## Architectural Patterns
- **Platform abstraction**: Conditional imports and method implementations based on _mswindows flag
- **Resource management**: Extensive use of context managers and try/finally for cleanup
- **Error propagation**: POSIX error pipe mechanism for child process failures (L1851-1958)
- **Optimization**: posix_spawn() fast path when constraints allow (L1825-1844)
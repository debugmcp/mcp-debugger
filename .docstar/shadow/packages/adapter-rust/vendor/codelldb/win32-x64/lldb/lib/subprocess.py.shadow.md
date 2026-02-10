# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/subprocess.py
@source-hash: baa9f9138d8d20df
@generated: 2026-02-09T18:13:21Z

## Primary Purpose
Python subprocess module providing process spawning, I/O pipe management, and process control capabilities with cross-platform Windows/POSIX support.

## Core Architecture
- Platform detection via `_mswindows` (L72-75) and `_can_fork_exec` (L78) flags
- Windows-specific imports from `_winapi` (L81-90)
- POSIX-specific imports from `_posixsubprocess` (L104) and process control functions (L106-117)
- Process cleanup management via `_active` list (L266) and `_cleanup()` function (L268-279)

## Key Constants
- `PIPE = -1`, `STDOUT = -2`, `DEVNULL = -3` (L281-283) - Special values for stream redirection
- `_USE_POSIX_SPAWN` (L745) and `_USE_VFORK` (L746) - Performance optimization flags

## Exception Classes
- `SubprocessError` (L123) - Base exception
- `CalledProcessError` (L126-161) - Non-zero exit status with cmd, returncode, stdout, stderr attributes
- `TimeoutExpired` (L163-189) - Process timeout with cmd, timeout, output attributes

## High-Level API Functions
- `run()` (L506-573) - Primary interface returning CompletedProcess
- `call()` (L381-395) - Returns exit code only
- `check_call()` (L398-414) - Raises CalledProcessError on non-zero exit
- `check_output()` (L417-467) - Returns stdout, raises on non-zero exit
- `getstatusoutput()` (L649-679) and `getoutput()` (L681-691) - Shell command utilities

## Core Classes

### CompletedProcess (L470-504)
Result object with args, returncode, stdout, stderr attributes and `check_returncode()` method (L499-503).

### Popen (L749-2216)
Main process execution class with extensive platform-specific implementations:

**Initialization (L807-1062)**:
- Cross-platform argument validation and stream setup
- Text/binary mode handling via `text_mode` attribute (L875)
- User/group permission handling for POSIX (L898-973)
- Pipe creation via `_get_handles()` method

**Windows Implementation (L1331-1683)**:
- `STARTUPINFO` class (L192-212) for process startup configuration  
- `Handle` class (L215-232) for resource management
- `_get_handles()` (L1335-1411) - Creates Windows pipes and handles
- `_execute_child()` (L1436-1561) - Process creation via CreateProcess
- Thread-based I/O via `_readerthread()` (L1598-1600) and `_communicate()` (L1603-1651)

**POSIX Implementation (L1684-2216)**:
- `_get_handles()` (L1688-1749) - Creates POSIX pipes with optional sizing
- `_posix_spawn()` (L1752-1789) - Modern spawn implementation when available
- `_execute_child()` (L1791-1958) - Fork/exec with comprehensive error handling
- Selector-based I/O via `_communicate()` (L2062-2161) using `_PopenSelector`

**Common Methods**:
- `communicate()` (L1165-1230) - Bidirectional I/O with timeout support
- `wait()` (L1259-1280) - Process completion waiting with KeyboardInterrupt handling
- `poll()` (L1233-1236) - Non-blocking status check
- `send_signal()`, `terminate()`, `kill()` - Process control

## Platform Abstractions
- Windows: Uses `_winapi.CreateProcess`, handle-based I/O, thread-based communication
- POSIX: Uses `fork_exec` or `posix_spawn`, file descriptor I/O, selector-based communication
- Automatic platform detection and capability negotiation

## Key Design Patterns
- Context manager support via `__enter__`/`__exit__` (L1089-1118)
- Resource cleanup in `__del__` (L1120-1133) with zombie process prevention
- Thread-safe waiting via `_waitpid_lock` (L828)
- Comprehensive error propagation from child to parent processes
- Optimization paths for simple cases (single pipe, no timeout)
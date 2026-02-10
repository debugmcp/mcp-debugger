# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/subprocess.py
@source-hash: baa9f9138d8d20df
@generated: 2026-02-09T18:07:36Z

## Primary Purpose
Python's subprocess module - provides cross-platform process spawning and communication capabilities. Part of LLDB's Python distribution for macOS ARM64. Implements PEP 324 subprocess interface with comprehensive I/O handling, signal management, and platform-specific optimizations.

## Key Classes and Functions

### Exception Classes (L123-189)
- **SubprocessError (L123)**: Base exception for subprocess operations
- **CalledProcessError (L126-161)**: Raised when process returns non-zero exit code, includes cmd/returncode/stdout/stderr attributes
- **TimeoutExpired (L163-189)**: Raised on timeout, includes cmd/timeout/output/stderr attributes

### Core API Classes
- **CompletedProcess (L470-504)**: Return type for run(), contains args/returncode/stdout/stderr attributes
- **Popen (L749-2216)**: Main process execution class with comprehensive parameter handling and platform-specific implementations

### High-Level Functions
- **run() (L506-573)**: Primary interface, returns CompletedProcess instance
- **call() (L381-396)**: Simple execution, returns exit code
- **check_call() (L398-414)**: Like call() but raises CalledProcessError on failure  
- **check_output() (L417-467)**: Returns stdout, raises CalledProcessError on failure
- **getstatusoutput() (L649-679)**: Shell execution returning (exitcode, output) tuple
- **getoutput() (L681-691)**: Shell execution returning only output

### Platform Detection and Constants (L69-118)
- **_mswindows (L75)**: Boolean flag detecting Windows via msvcrt presence
- **_can_fork_exec (L78)**: Checks for WASM platform limitations
- **PIPE/STDOUT/DEVNULL (L281-283)**: Special values for I/O redirection

## Architecture Patterns

### Platform Abstraction
- Conditional imports and implementations based on _mswindows flag
- Windows: Uses _winapi, Handle class (L215-232), STARTUPINFO (L192-212)
- POSIX: Uses _posixsubprocess, select/selectors for I/O multiplexing

### Process Creation Strategies
- **Windows**: CreateProcess API with handle management
- **POSIX**: Prefers posix_spawn() when available (_USE_POSIX_SPAWN L745), falls back to fork/exec
- **Optimization**: _use_posix_spawn() (L695-741) detects optimal implementation

### I/O Management
- **Pipe Creation**: _get_handles() methods create parent/child file descriptor pairs
- **Communication**: Platform-specific _communicate() implementations
- **Windows**: Thread-based I/O with _readerthread() (L1598-1600)
- **POSIX**: Selector-based non-blocking I/O with _PIPE_BUF optimization (L237)

## Key Invariants and Constraints

### Thread Safety
- **_waitpid_lock (L828)**: Protects returncode updates from concurrent wait operations
- **_active list (L266)**: Global cleanup list for zombie process prevention on POSIX

### Resource Management
- **_cleanup() (L259-279)**: Automatic cleanup of terminated processes
- **Context Manager**: __enter__/__exit__ (L1089-1118) ensures proper cleanup
- **Error Handling**: _on_error_fd_closer() (L1311-1329) prevents descriptor leaks

### Signal Handling
- **KeyboardInterrupt**: Special handling with _sigint_wait_secs timeout (L882)
- **POSIX Signals**: send_signal()/terminate()/kill() methods with race condition mitigation

### Text/Binary Mode
- **text_mode attribute (L875)**: Controls encoding/decoding behavior
- **_text_encoding() (L361-378)**: Default encoding selection with EncodingWarning support

## Critical Implementation Details

### Process Spawning Paths
- **posix_spawn optimization (L825-844)**: Used when conditions allow for better performance
- **fork_exec fallback (L885-894)**: Traditional fork/exec with comprehensive error pipe handling
- **Error Propagation**: errpipe mechanism (L851-958) for child process failures

### Windows-Specific Features
- **Handle inheritance**: _filter_handle_list() (L1423-1433) manages console handle issues
- **Shell execution**: Automatic ComSpec resolution (L518-528) with security considerations
- **Process termination**: TerminateProcess with permission error handling

### POSIX-Specific Features  
- **File descriptor management**: Careful closing of unused descriptors in child
- **Signal restoration**: Configurable signal handling in child process
- **User/Group switching**: Support for uid/gid/extra_groups parameters
- **Working directory**: chdir error handling with specific error messages
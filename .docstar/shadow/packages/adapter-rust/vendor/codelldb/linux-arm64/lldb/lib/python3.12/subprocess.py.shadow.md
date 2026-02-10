# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/subprocess.py
@source-hash: baa9f9138d8d20df
@generated: 2026-02-09T18:09:23Z

## Primary Purpose

This is Python's `subprocess` module - a comprehensive process spawning and management library that allows creating, communicating with, and controlling external processes. This appears to be from a vendor distribution (LLDB/CodeLLDB) rather than standard Python.

## Core Architecture

**Platform Detection (L69-120)**: Uses `msvcrt` import to detect Windows vs POSIX systems, with separate code paths for each platform. Also detects WASM platforms that don't support processes.

**Exception Hierarchy (L123-189)**:
- `SubprocessError` (L123): Base exception class
- `CalledProcessError` (L126-161): Raised when process exits with non-zero status
- `TimeoutExpired` (L163-189): Raised when process times out

## Key Constants and Configuration

- `PIPE = -1, STDOUT = -2, DEVNULL = -3` (L281-283): Special values for stream redirection
- `_USE_POSIX_SPAWN` (L745): Feature flag for using posix_spawn() vs fork/exec
- `_USE_VFORK = True` (L746): Feature flag for vfork optimization

## Main API Functions

**High-level convenience functions**:
- `run()` (L506-573): Primary modern API, returns `CompletedProcess`
- `call()` (L381-395): Simple wrapper, returns exit code
- `check_call()` (L398-414): Like call() but raises on non-zero exit
- `check_output()` (L417-467): Returns stdout, raises on failure

**Legacy shell functions**:
- `getstatusoutput()` (L649-679): Shell execution returning (status, output)
- `getoutput()` (L681-691): Shell execution returning just output

## Core Classes

**CompletedProcess (L470-503)**: Return value from `run()` containing:
- `args`, `returncode`, `stdout`, `stderr` attributes
- `check_returncode()` method (L499-503)

**Popen (L749-2216)**: The main process execution class with extensive cross-platform implementation:

### Constructor Parameters (L807-815):
- Standard streams: `stdin`, `stdout`, `stderr`
- Process control: `shell`, `cwd`, `env`, `executable`
- POSIX-specific: `preexec_fn`, `user`, `group`, `umask`, `pass_fds`
- Windows-specific: `startupinfo`, `creationflags`
- Encoding: `text`, `encoding`, `errors`, `universal_newlines`

### Key Methods:
- `communicate()` (L1165-1230): Primary I/O interaction method
- `wait()` (L1259-1280): Wait for process completion
- `poll()` (L1233-1236): Non-blocking status check
- `send_signal()`, `terminate()`, `kill()`: Process control

### Platform-Specific Implementation:

**Windows Path (L1331-1682)**:
- `_get_handles()` (L1335-1411): Windows handle management
- `_execute_child()` (L1436-1561): Uses CreateProcess API
- `_communicate()` (L1603-1651): Thread-based I/O handling

**POSIX Path (L1684-2216)**:
- `_get_handles()` (L1688-1749): POSIX file descriptor management  
- `_posix_spawn()` (L1752-1789): Modern posix_spawn() implementation
- `_execute_child()` (L1791-1958): Traditional fork/exec implementation
- `_communicate()` (L2062-2161): Select/poll-based I/O handling

## Utility Functions

- `list2cmdline()` (L576-643): Windows command line escaping
- `_args_from_interpreter_flags()` (L300-358): Reproduces Python interpreter flags
- `_text_encoding()` (L361-378): Default text encoding detection with warnings
- `_use_posix_spawn()` (L695-740): Platform capability detection for posix_spawn

## Resource Management

**Process Cleanup (L257-279)**: Global `_active` list tracks processes needing cleanup, with `_cleanup()` function to reap zombie processes.

**File Descriptor Management**: Extensive error handling context managers (`_on_error_fd_closer`, L311-329) ensure FDs are closed even on exceptions.

**Threading Considerations**: Uses locks (`_waitpid_lock`, L828) to prevent race conditions in multi-threaded scenarios.

## Notable Patterns

1. **Cross-platform abstraction**: Single interface with platform-specific implementations
2. **Defensive programming**: Extensive error handling and resource cleanup
3. **Performance optimization**: Uses posix_spawn when available, vfork where possible
4. **Backward compatibility**: Maintains legacy APIs while providing modern interfaces
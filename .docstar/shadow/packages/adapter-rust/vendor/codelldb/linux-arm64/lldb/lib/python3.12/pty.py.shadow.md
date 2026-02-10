# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/pty.py
@source-hash: ddbb1749387539c2
@generated: 2026-02-09T18:09:03Z

## Primary Purpose
Provides pseudo-terminal (pty) utilities for Unix-like systems, enabling process spawning with terminal control and bidirectional I/O copying between master/slave pty pairs.

## Key Functions

### Core PTY Operations
- **`openpty()` (L26-36)**: Primary function to open a master/slave pty pair, with fallback to manual terminal opening
- **`_open_terminal()` (L57-67)**: Fallback implementation that manually searches `/dev/pty*` devices when `os.openpty()` unavailable
- **`fork()` (L90-116)**: Creates a child process with controlling terminal, using `os.forkpty()` with manual fallback

### Deprecated API
- **`master_open()` (L38-55)**: Deprecated wrapper for opening pty master (warns about removal in Python 3.14)
- **`slave_open()` (L69-88)**: Deprecated function for opening pty slave with STREAMS modules support

### Process Management
- **`spawn()` (L187-211)**: High-level function to spawn a process in a pty, handles terminal mode switching and cleanup
- **`_copy()` (L122-185)**: Core I/O multiplexing loop using `select()` to copy data bidirectionally between stdin/stdout and pty master
- **`_read()` (L118-120)**: Default read function (1024-byte chunks)

## Key Dependencies
- **Standard library**: `os`, `sys`, `select`, `tty`
- **Imported for testing**: `close`, `waitpid`, `setraw`, `tcgetattr`, `tcsetattr` (L14-16)
- **Optional**: `fcntl` for STREAMS support (Solaris-style systems)

## Architecture Patterns
- **Graceful degradation**: Primary functions try modern OS APIs first (`os.openpty`, `os.forkpty`), fall back to manual implementations
- **Cross-platform compatibility**: Handles different Unix variants with varying pty support
- **Non-blocking I/O**: `_copy()` temporarily sets master_fd to non-blocking mode to prevent deadlocks (L127-137)

## Critical Constraints
- **Buffer management**: Uses 4096-byte high water level for I/O buffers to prevent memory issues (L138)
- **Platform limitations**: Only tested on Linux, FreeBSD, macOS (noted in header comments)
- **Signal handling**: No signal handling implemented (known limitation, L3)
- **Terminal settings**: Doesn't set slave termios/window size (known limitation, L3)

## Constants
- Standard file descriptors: `STDIN_FILENO=0`, `STDOUT_FILENO=1`, `STDERR_FILENO=2` (L20-22)
- Child process indicator: `CHILD=0` (L24)

## Error Handling
- PTY device exhaustion raises `OSError('out of pty devices')` (L67)
- EOF detection through empty reads or OSError exceptions (L165-173)
- Graceful handling of terminal attribute failures in `spawn()` (L201-202)
# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/pty.py
@source-hash: ddbb1749387539c2
@generated: 2026-02-09T18:07:57Z

## Primary Purpose
Cross-platform pseudo-terminal (PTY) utilities for creating master/slave terminal pairs and spawning child processes with controlling terminals. Provides both high-level convenience functions and lower-level primitives with fallbacks for different Unix-like systems.

## Key Functions

**openpty() (L26-36)** - Primary function to create master/slave PTY pair. Uses os.openpty() when available, falls back to manual terminal allocation via _open_terminal().

**master_open() (L38-55)** - **DEPRECATED** function to open PTY master and return slave name. Issues deprecation warning, scheduled for removal in Python 3.14.

**_open_terminal() (L57-67)** - Internal fallback implementation that manually searches for available PTY devices using /dev/pty[pqrstuvwxyzPQRST][0-9a-f] naming scheme.

**slave_open() (L69-88)** - **DEPRECATED** function to open PTY slave with controlling terminal setup. Handles platform-specific STREAMS modules (ptem, ldterm) on systems that support them.

**fork() (L90-116)** - Creates child process with PTY. Uses os.forkpty() when available, otherwise manually creates PTY pair and forks. Child becomes session leader with controlling terminal.

**spawn() (L187-211)** - High-level function to execute command in PTY environment. Sets up raw terminal mode, handles I/O copying between terminal and PTY, and restores terminal state on completion.

**_copy() (L122-185)** - Core I/O multiplexing loop using select(). Manages bidirectional data flow between stdin/stdout and PTY master with buffering (4KB high water mark). Handles blocking/non-blocking mode transitions and EOF conditions.

**_read() (L118-120)** - Default read function for I/O operations, reads 1KB chunks.

## Key Dependencies
- `select.select` for I/O multiplexing
- `os` module for low-level PTY and process operations
- `tty` module for terminal control and raw mode
- Platform-specific: `fcntl` for STREAMS ioctl on some systems

## Architecture Patterns
- **Graceful degradation**: Primary functions try modern OS APIs (os.openpty, os.forkpty) before falling back to manual implementations
- **Platform abstraction**: Handles differences between Linux, FreeBSD, macOS, and other Unix variants
- **Event-driven I/O**: Uses select() for non-blocking I/O multiplexing with buffering
- **Resource cleanup**: Proper file descriptor management and terminal state restoration

## Critical Constraints
- **Platform limitations**: Only tested on Linux, FreeBSD, and macOS
- **Signal handling**: Explicitly noted as missing - no signal handling implemented
- **Terminal settings**: Does not set slave termios or window size
- **Buffer limits**: 4KB high water mark prevents excessive buffering
- **Blocking behavior**: Temporarily switches to non-blocking mode during copy operations for compatibility

## Constants
- Standard file descriptors: STDIN_FILENO=0, STDOUT_FILENO=1, STDERR_FILENO=2 (L20-22)
- CHILD=0 for process identification (L24)
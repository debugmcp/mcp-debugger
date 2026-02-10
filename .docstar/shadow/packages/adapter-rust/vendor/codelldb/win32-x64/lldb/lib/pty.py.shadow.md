# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/pty.py
@source-hash: ddbb1749387539c2
@generated: 2026-02-09T18:14:27Z

## Primary Purpose
Unix pseudo-terminal (pty) utilities for creating master/slave terminal pairs and spawning processes with controlling terminals. Provides cross-platform abstractions for pty operations, falling back to manual pty device enumeration when `os.openpty()` is unavailable.

## Key Functions and Architecture

### Core Terminal Operations
- `openpty()` (L26-36): Main interface returning (master_fd, slave_fd) tuple. Prefers `os.openpty()`, falls back to `_open_terminal()`
- `_open_terminal()` (L57-67): Manual pty allocation by iterating through `/dev/pty[pqrstuvwxyzPQRST][0-9a-f]` device names
- `slave_open(tty_name)` (L69-88): Opens slave terminal with optional STREAMS module configuration (Solaris/SVR4)

### Process Management
- `fork()` (L90-116): Creates child process with controlling terminal. Uses `os.forkpty()` when available, otherwise manual fork + `os.login_tty()`
- `spawn(argv, master_read=_read, stdin_read=_read)` (L187-211): High-level interface to fork process and handle terminal I/O

### I/O Handling
- `_copy(master_fd, master_read=_read, stdin_read=_read)` (L122-185): Bidirectional I/O loop using `select()` with buffering
- `_read(fd)` (L118-120): Default read function (1024 bytes)

## Dependencies and Imports
- Core modules: `os`, `sys`, `select`, `tty`
- Conditional imports: `fcntl` (for STREAMS), `warnings` (deprecation)
- Direct imports for testing: `close`, `waitpid`, `setraw`, `tcgetattr`, `tcsetattr`

## Key Constants
- File descriptors: `STDIN_FILENO=0`, `STDOUT_FILENO=1`, `STDERR_FILENO=2`
- Child process identifier: `CHILD=0`
- Buffer management: `high_waterlevel=4096` for flow control

## Critical Patterns
- **Graceful degradation**: Always tries modern OS APIs first, falls back to manual implementations
- **Non-blocking I/O**: Sets master_fd non-blocking during copy operations to prevent deadlocks
- **Resource cleanup**: Proper fd closure in parent/child processes and terminal mode restoration
- **Cross-platform compatibility**: Handles platform differences (Linux, FreeBSD, macOS, Solaris)

## Deprecated APIs
- `master_open()` (L38-55): Deprecated in favor of `openpty()`
- `slave_open()` (L69-88): Deprecated in favor of `openpty()`

## Constraints and Limitations
- No signal handling (documented bug)
- Doesn't set slave termios and window size
- Manual pty enumeration limited to specific character ranges
- Platform testing limited to Linux, FreeBSD, macOS
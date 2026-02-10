# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/pty.py
@source-hash: ddbb1749387539c2
@generated: 2026-02-09T18:07:18Z

**Purpose:** Python pseudo-terminal (pty) utilities module providing cross-platform functionality for creating and managing pseudo-terminals. Part of Python's standard library, designed for UNIX-like systems.

**Core API Functions:**
- `openpty()` (L26-36): Creates master/slave pty pair, preferring `os.openpty()` with fallback to manual device enumeration
- `fork()` (L90-116): Forks process and establishes controlling terminal, using `os.forkpty()` when available
- `spawn(argv, master_read, stdin_read)` (L187-211): High-level interface to spawn process in pty with I/O copying

**Low-Level Utilities:**
- `master_open()` (L38-55): DEPRECATED - Opens pty master, returns fd and slave name
- `slave_open(tty_name)` (L69-88): DEPRECATED - Opens pty slave with optional terminal discipline setup
- `_open_terminal()` (L57-67): Manual pty allocation by scanning `/dev/pty*` devices
- `_read(fd)` (L118-120): Default read function for 1024-byte chunks
- `_copy(master_fd, master_read, stdin_read)` (L122-185): Bidirectional I/O copying between pty and stdin/stdout

**Key Architecture Patterns:**
- Graceful degradation: Always attempts native OS functions first, falls back to manual implementation
- Non-blocking I/O handling: Temporarily switches master_fd to non-blocking mode during copy operations
- Buffer management: Uses 4096-byte high watermark for flow control in `_copy()`
- Signal handling via `select()` for multiplexed I/O operations

**Dependencies:**
- Core: `os`, `sys`, `tty`, `select`
- Conditional: `fcntl` (for STREAMS ioctl on some systems)
- Test support: Explicitly imports functions for mocking

**Critical Constants:**
- File descriptors: `STDIN_FILENO=0`, `STDOUT_FILENO=1`, `STDERR_FILENO=2` (L20-22)
- Process constants: `CHILD=0` (L24)

**Platform Considerations:**
- Tested on Linux, FreeBSD, macOS (L4)
- Manual pty enumeration covers traditional BSD-style naming
- STREAMS terminal discipline handling for compatibility

**Error Handling:**
- OSError exceptions handled throughout for robustness
- EOF detection via empty reads or exceptions
- Automatic cleanup when child processes exit
# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/pty.py
@source-hash: ddbb1749387539c2
@generated: 2026-02-09T18:09:55Z

**Python PTY (Pseudo Terminal) Utilities Module**

Provides cross-platform pseudo terminal operations for Unix-like systems, enabling terminal emulation and process spawning with controlling terminals.

## Core Functions

**openpty() (L26-36)**: Primary interface for creating master/slave pty pairs. Falls back to manual terminal allocation if os.openpty() unavailable.

**fork() (L90-116)**: Creates child process with controlling terminal. Attempts os.forkpty() first, falls back to manual pty creation + os.fork() + os.login_tty().

**spawn(argv, master_read=_read, stdin_read=_read) (L187-211)**: High-level interface to spawn processes in pty environment. Handles terminal mode switching (raw mode), I/O copying, and cleanup.

## Internal Implementation

**_open_terminal() (L57-67)**: Manual pty allocation by iterating through /dev/pty[p-z][0-f] device nodes. Legacy fallback for systems without os.openpty().

**_copy(master_fd, master_read=_read, stdin_read=_read) (L122-186)**: Core I/O multiplexing loop using select(). Handles bidirectional data flow between stdin/stdout and pty master with buffering (4096 byte high watermark). Manages non-blocking I/O to prevent deadlocks.

**_read(fd) (L118-120)**: Default read function (1024 byte chunks).

## Deprecated APIs

**master_open() (L38-55)**: Deprecated pty master opener, issues DeprecationWarning.
**slave_open(tty_name) (L69-88)**: Deprecated pty slave opener with Solaris STREAMS support.

## Dependencies

- `select.select` for I/O multiplexing
- `os` for low-level system calls (openpty, forkpty, fork, etc.)
- `tty` for terminal control (setraw, tcgetattr, tcsetattr)

## Architecture Notes

- Graceful degradation: prefers modern os.openpty()/os.forkpty(), falls back to manual implementation
- Buffer management prevents blocking on full terminal buffers
- Supports custom read functions for specialized I/O handling
- Unix-specific implementation (Linux, FreeBSD, macOS tested)

## Constants

- Standard file descriptors: STDIN_FILENO(0), STDOUT_FILENO(1), STDERR_FILENO(2)
- CHILD(0) for process identification
- High water level (4096 bytes) for buffering
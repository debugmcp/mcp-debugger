# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/unix_events.py
@source-hash: 1fff06cce7876380
@generated: 2026-02-09T18:10:35Z

## Unix Event Loop Implementation for asyncio

This file provides Unix-specific event loop implementation with signal handling and Unix domain socket support. It's part of Python's asyncio package and is specifically for Unix-like systems (excludes Windows per L38-39).

### Core Event Loop Class

**`_UnixSelectorEventLoop` (L57-458)**: Main Unix event loop extending `selector_events.BaseSelectorEventLoop`. Adds signal handling, Unix domain sockets, subprocess transport creation, and native sendfile support.

Key methods:
- `add_signal_handler()` (L88-132): Register signal handlers using wakeup file descriptor mechanism
- `remove_signal_handler()` (L143-173): Unregister signal handlers, restore default handlers
- `_handle_signal()` (L133-141): Internal signal processing via self-pipe trick
- `create_unix_connection()` (L231-279): Create client connections over Unix domain sockets
- `create_unix_server()` (L281-352): Create servers listening on Unix domain sockets
- `_sock_sendfile_native()` (L354-375): High-performance file sending using os.sendfile()

### Transport Classes

**`_UnixReadPipeTransport` (L460-602)**: Transport for reading from pipes/sockets with flow control. Validates file descriptor types (pipes, sockets, character devices) and handles EOF detection.

**`_UnixWritePipeTransport` (L604-807)**: Transport for writing to pipes/sockets with buffering. Implements write flow control and handles peer disconnection detection via read polling on certain platforms.

**`_UnixSubprocessTransport` (L809-831)**: Subprocess transport with AIX-specific stdin handling using socket pairs for proper event detection.

### Child Process Watchers

**`AbstractChildWatcher` (L833-917)**: Base class defining interface for monitoring child processes. Marked deprecated as of Python 3.12.

**`PidfdChildWatcher` (L919-975)**: Linux-specific implementation using pidfd file descriptors (Linux 5.3+). Most efficient, scales linearly without signals or threads.

**`SafeChildWatcher` (L1030-1109)**: Conservative implementation polling specific PIDs on SIGCHLD. Safe but O(n) overhead. Deprecated.

**`FastChildWatcher` (L1111-1218)**: Aggressive implementation using waitpid(-1) that may interfere with external processes. O(1) performance but risky. Deprecated.

**`MultiLoopChildWatcher` (L1220-1347)**: Thread-safe watcher that doesn't require main thread event loop. Uses global SIGCHLD handler. Deprecated.

**`ThreadedChildWatcher` (L1349-1429)**: Creates dedicated thread per subprocess for waiting. No signals needed, O(1) complexity.

### Policy and Utilities

**`_UnixDefaultEventLoopPolicy` (L1442-1497)**: Default event loop policy for Unix. Automatically selects PidfdChildWatcher on supported systems, falls back to ThreadedChildWatcher.

**Utility functions**:
- `waitstatus_to_exitcode()` (L47-54): Convert waitpid status to exit code
- `can_use_pidfd()` (L1430-1439): Runtime check for pidfd support
- `_sighandler_noop()` (L42-44): Dummy signal handler for wakeup fd mechanism

### Key Architectural Patterns

- **Self-pipe trick**: Signal handling uses wakeup file descriptor to integrate with event loop
- **Transport validation**: File descriptor type checking ensures proper transport usage
- **Platform-specific workarounds**: Special handling for AIX subprocess stdin and read polling
- **Progressive fallback**: Child watcher selection from most efficient (pidfd) to most compatible (threaded)
- **Resource cleanup**: Proper signal handler removal and transport cleanup with warnings for unclosed resources
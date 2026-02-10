# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/process/unix/mod.rs
@source-hash: 6c084b4a1821ee5c
@generated: 2026-02-09T18:03:12Z

## Primary Purpose

Unix-specific implementation of async child process management for Tokio. Handles the complexities of waiting for process exit status on Unix systems where processes can't be directly registered with epoll/kqueue, requiring signal-based notification through SIGCHLD.

## Core Architecture

The module provides two main child process monitoring strategies:
1. **Signal-based reaping** using SIGCHLD signals (default)
2. **Pidfd-based reaping** on Linux with runtime feature enabled (L108-109)

## Key Components

### Child Process Management
- **Child enum (L106-110)**: Main async process wrapper with two variants - SignalReaper for SIGCHLD-based monitoring and PidfdReaper for Linux pidfd support
- **build_child() (L118-145)**: Factory function that attempts pidfd reaper first (Linux), falls back to signal-based reaper. Extracts and wraps stdio handles
- **GlobalOrphanQueue (L85-103)**: Singleton queue managing orphaned processes, delegates to static OrphanQueueImpl instance

### Stdio Handling  
- **Pipe struct (L188-271)**: Wrapper around File descriptor providing async I/O traits (AsyncRead/AsyncWrite) and mio Source implementation
- **ChildStdio (L273-340)**: PollEvented wrapper around Pipe for async stdio operations
- **stdio() factory (L365-373)**: Creates ChildStdio from raw fd, sets nonblocking mode

### Process Lifecycle
- **Wait trait impl for StdChild (L51-59)**: Provides id() and try_wait() methods
- **Kill trait impl for StdChild (L61-65)**: Provides kill() method
- **Future impl for Child (L175-185)**: Delegates polling to underlying reaper variant

## Critical Implementation Details

### Signal Handling Strategy
The module addresses Unix's limitation where child processes cannot be registered with epoll. Uses SIGCHLD signals but acknowledges signal coalescing means one signal may represent multiple child exits. Solution: check ALL spawned processes on each SIGCHLD (L12-18).

### File Descriptor Management
- **set_nonblocking() (L342-363)**: Low-level fcntl wrapper to toggle O_NONBLOCK flag
- **convert_to_blocking_file() (L233-243)**: Ensures inherited fds are blocking for child processes
- **convert_to_stdio() (L245-247)**: Converts ChildStdio to std::process::Stdio

### Conditional Compilation
- Pidfd reaper only available on Linux with "rt" feature (L30-31, L108-109, L123-135)
- Two different orphan queue implementations based on const mutex availability (L67-83)

## Dependencies & Integration

- Integrates with Tokio's signal system via `crate::signal::unix`
- Uses mio for low-level I/O event registration
- Depends on `orphan` and `reap` modules for process lifecycle management
- Leverages PollEvented for async I/O operations

## Architectural Patterns

- **Strategy pattern**: Child enum switches between signal/pidfd reaping strategies
- **Singleton pattern**: GlobalOrphanQueue provides static access to orphan management
- **Wrapper pattern**: Pipe wraps File to reuse close-on-drop semantics
- **Factory pattern**: build_child() encapsulates construction logic with fallback strategy
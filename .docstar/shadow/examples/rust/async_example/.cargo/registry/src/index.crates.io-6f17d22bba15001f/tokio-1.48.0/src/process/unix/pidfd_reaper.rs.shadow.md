# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/process/unix/pidfd_reaper.rs
@source-hash: 9bd20fef3160f4b9
@generated: 2026-02-09T18:03:05Z

## Purpose
Linux-specific process reaper implementation using pidfd (process file descriptors) for efficient async child process waiting. Provides a modern alternative to signal-based reaping with better resource management and race condition avoidance.

## Key Components

### Pidfd Wrapper (L25-87)
- `Pidfd` struct wraps a Linux pidfd file descriptor
- `open(pid: u32)` (L31-56): Creates pidfd via `SYS_pidfd_open` syscall, caches unsupported system state in static
- Implements `AsRawFd` and mio `Source` for async I/O integration
- Uses `PIDFD_NONBLOCK` flag for non-blocking operation

### Core Reaper Logic (L89-163)
- `PidfdReaperInner<W>` (L90-96): Wraps process waiter with polled pidfd
- Future implementation (L138-163): Polls pidfd for readiness, calls `try_wait()` on ready events
- Handles runtime shutdown gracefully via `is_rt_shutdown_err()` (L128-136)
- Re-registers interest and wakes context on poll cycles

### Public Interface (L165-252)
- `PidfdReaper<W, Q>` (L166-173): Main public struct combining inner reaper with orphan queue
- `new()` (L192-204): Factory method with fallback error handling if pidfd unavailable
- Implements `Future`, `Kill`, and `Deref` traits for seamless process control
- Drop implementation (L239-252): Moves unreaped processes to orphan queue for cleanup

### Utilities
- `display_eq()` (L98-125): Custom formatter equality checker for error message matching
- `is_rt_shutdown_err()` (L128-136): Detects Tokio runtime shutdown errors

## Dependencies & Integration
- Requires Linux kernel 5.10+ for pidfd support
- Integrates with Tokio's `PollEvented` for async I/O
- Uses mio for low-level event registration
- Connects to orphan queue system for process cleanup
- Implements standard Tokio process traits (`Wait`, `Kill`)

## Architecture Notes
- Graceful degradation: returns error if pidfd unsupported rather than panicking
- Static caching of system capability to avoid repeated syscall failures
- Proper RAII: processes moved to orphan queue on drop if still running
- Race-free: pidfd eliminates PID reuse races inherent in signal-based approaches
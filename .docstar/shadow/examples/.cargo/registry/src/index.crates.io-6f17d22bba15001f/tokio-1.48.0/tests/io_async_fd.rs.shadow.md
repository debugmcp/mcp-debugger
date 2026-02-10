# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_async_fd.rs
@source-hash: 36840ed1c3ef07c4
@generated: 2026-02-09T18:12:28Z

## Purpose
Comprehensive test suite for Tokio's `AsyncFd` functionality - async wrapper for Unix file descriptors that integrates with Tokio's reactor. Tests readiness notifications, guard behavior, and integration with the async runtime.

## Key Test Infrastructure

### TestWaker (L24-57)
Custom waker implementation for testing async polling behavior:
- `TestWakerInner` (L29-38): Tracks wake events via `AtomicBool`
- `TestWaker::new()` (L41-48): Creates waker from `ArcWake` trait
- `awoken()` (L50-52): Checks and resets wake state
- `context()` (L54-56): Provides polling context

### FileDescriptor (L59-100)
Test wrapper for owned file descriptors:
- Implements `AsRawFd`, `Read`, `Write` for both owned and borrowed forms
- Uses `nix` crate for syscalls (read/write operations)
- Delegates between `&FileDescriptor` and `FileDescriptor` implementations

### Utility Functions
- `set_nonblocking()` (L102-118): Configures file descriptor for non-blocking I/O using fcntl
- `socketpair()` (L120-136): Creates connected Unix domain socket pair for testing
- `drain()` (L138-148): Reads specified amount of data from file descriptor
- `assert_pending()` (L559-567): Helper to verify futures remain pending

## Core Test Categories

### Readiness State Management
- `initially_writable` (L150-166): Verifies new sockets are writable but not readable
- `reset_readable` (L168-210): Tests explicit readiness state clearing with `clear_ready()`
- `reset_writable` (L212-239): Tests writable state management through write saturation

### Guard Behavior  
- `guard_try_io` (L298-331): Tests `AsyncFdReadyGuard::try_io()` behavior - only clears ready state on `WouldBlock` errors
- `try_io_readable` (L333-390): Tests `AsyncFd::try_io()` with readable interest
- `try_io_writable` (L392-431): Tests `AsyncFd::try_io()` with writable interest

### Lifecycle Management
- `drop_closes` (L249-287): Verifies `AsyncFd` drop behavior vs `into_inner()` - includes `ArcFd` wrapper test (L241-247)
- `reregister` (L289-296): Tests re-registering file descriptor after `into_inner()`

### Concurrency
- `multiple_waiters` (L433-479): Tests 10 concurrent tasks waiting on same `AsyncFd` with barrier synchronization
- `poll_fns` (L481-557): Complex test of `poll_read_ready`/`poll_write_ready` with multiple tasks and custom wakers

### Runtime Shutdown Behavior
Series of tests (L576-717) verifying proper cleanup when Tokio runtime is dropped:
- `driver_shutdown_wakes_currently_pending` (L576-595): Futures initialized before RT drop
- `driver_shutdown_wakes_future_pending` (L597-610): Futures initialized after RT drop  
- `driver_shutdown_wakes_pending_race` (L612-632): Race condition testing
- Similar tests for poll functions (L642-717)

### Platform-Specific Features
- `priority_event_on_oob_data` (L719-741): Linux/Android TCP out-of-band data testing
- `send_oob_data` (L743-758): Helper using raw libc calls
- Error readiness tests for Linux UDP sockets with timestamping (L806-861) and invalid addresses (L863-931)

### Ready State Manipulation
- `clear_ready_matching_clears_ready` (L760-781): Tests selective ready state clearing
- `clear_ready_matching_clears_ready_mut` (L783-804): Same for mutable guards

### Error Handling
- `try_new` (L942-950): Tests `AsyncFd::try_new()` error case with invalid FD
- `try_with_interest` (L952-960): Tests `AsyncFd::try_with_interest()` error case
- `InvalidSource` (L933-940): Mock type returning invalid file descriptor (-1)

## Key Dependencies
- `tokio::io::unix::{AsyncFd, AsyncFdReadyGuard}` - Primary types under test
- `nix` crate - Unix system calls (socketpair, read/write, fcntl)
- `futures` - Polling utilities and task management
- `tokio_test` - Test assertions (`assert_pending`, `assert_err`)

## Architecture Notes
- Tests exclusively target Unix platforms with "full" feature enabled (L2)
- Heavy use of `tokio::select!` for timeout-based assertions
- Barrier synchronization pattern for coordinating concurrent test scenarios
- Platform-conditional compilation for Linux-specific socket features
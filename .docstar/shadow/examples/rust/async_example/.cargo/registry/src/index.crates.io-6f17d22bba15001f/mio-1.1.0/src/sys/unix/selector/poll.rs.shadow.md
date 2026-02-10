# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/unix/selector/poll.rs
@source-hash: e5ff526f0b3f8b61
@generated: 2026-02-09T17:58:35Z

This file implements a poll-based I/O event selector for Unix systems in the mio async I/O library. It provides a thread-safe, multi-producer single-consumer event polling system using the POSIX `poll()` system call.

## Core Components

**Selector (L27-84)**: Main public interface that wraps `SelectorState` in an `Arc` for thread safety. Provides methods for registration (`register`, L50), reregistration (`reregister`, L65), deregistration (`deregister`, L69), and event polling (`select`, L46). The `try_clone` method (L40) enables sharing the selector across threads.

**SelectorState (L88-444)**: Core implementation containing:
- `fds: Mutex<Fds>` (L90): Protected collection of file descriptors to poll
- `pending_removal: Mutex<Vec<RawFd>>` (L96): FDs marked for removal during concurrent polling
- `pending_wake_token: Mutex<Option<Token>>` (L101): Token for synthetic wake events
- `notify_waker: WakerInternal` (L106): Internal waker for interrupting poll operations
- `waiting_operations: AtomicUsize` (L111): Counter for concurrent operations requiring poll interruption
- `operations_complete: Condvar` (L116): Synchronization primitive for operation completion

**Fds (L125-134)**: Contains `poll_fds: Vec<PollFd>` (L130) for the actual poll array and `fd_data: HashMap<RawFd, FdData>` (L133) mapping file descriptors to their metadata.

**PollFd (L138-150)**: Transparent wrapper around `libc::pollfd` with Debug implementation.

**FdData (L153-162)**: Associates each registered FD with its poll array index (L156), event token (L158), and shared registration record (L161).

**RegistrationRecord (L453-472)**: Shared state between selector and I/O sources using `AtomicBool` (L454) to track registration status and prevent double-deregistration.

## Key Operations

**select() (L187-294)**: Main event loop that:
1. Waits for concurrent operations to complete using condition variables
2. Calls `poll()` system call (L210) with timeout handling
3. Processes waker events and file descriptor events
4. Handles pending removals to avoid race conditions
5. Automatically deregisters FDs that receive POLLHUP/POLLERR (L265-268)
6. Optimizes event processing by clearing triggered interests (L273)

**register_internal() (L300-357)**: Registers FDs with race condition handling:
- Removes FD from pending removal list if present (L324-327)
- Uses `modify_fds` helper (L379) to coordinate with concurrent polling
- Creates new `RegistrationRecord` for shared state tracking

**deregister_all() (L404-438)**: Efficient batch deregistration that uses swap_remove optimization (L420) and updates indices of swapped elements.

**modify_fds() (L379-399)**: Critical synchronization helper that:
- Increments operation counter and wakes polling thread
- Acquires FD mutex safely
- Decrements counter and signals completion

## Event Processing

**Event (L545-548)**: Simple struct containing token and raw poll events.

**event module (L552-630)**: Provides event interpretation functions like `is_readable()` (L564), `is_writable()` (L568), `is_read_closed()` (L576) with platform-specific POLLRDHUP handling.

**interests_to_poll() (L486-502)**: Converts mio Interest flags to libc poll event flags.

**poll() helper (L505-542)**: Wraps system call with timeout conversion, handles kernel timeout limits on 32-bit systems (L510-513), and retries on EAGAIN.

## Waker Implementation

**Waker (L633-649)**: Public waker that holds selector reference and token, delegates to selector's wake method.

**IoSourceState (L670-753)**: Manages I/O source lifecycle with automatic deregistration on drop (L662-668). The `do_io` method (L679) automatically re-registers interests after WouldBlock errors, implementing edge-triggered behavior simulation.

## Architecture Notes

- Thread-safe design using Arc sharing with internal mutexes
- Race condition handling between registration/deregistration and polling
- Optimization for batch operations and minimal syscalls
- Integration with mio's token-based event system
- Platform abstraction over poll/POLLRDHUP differences
# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/unix/selector/epoll.rs
@source-hash: 689ade2c72f85caa
@generated: 2026-02-09T17:58:20Z

## Purpose and Responsibility

This file implements the epoll-based selector for the Mio library on Unix systems, providing event-driven I/O polling capabilities. It wraps Linux's epoll system call interface to enable asynchronous I/O operations through interest registration and event polling.

## Key Components

### Primary Selector Structure
- **Selector (L20-24)**: Main epoll wrapper containing an owned file descriptor (`ep`) and optional debug ID. Manages the epoll instance lifecycle and provides the core I/O multiplexing interface.

### Core Methods
- **new() (L27-35)**: Creates new epoll instance using `epoll_create1` with CLOEXEC flag. Assigns unique ID in debug builds using atomic counter.
- **try_clone() (L37-44)**: Duplicates the selector by cloning the underlying file descriptor while preserving the same debug ID.
- **select() (L46-71)**: Main event polling method using `epoll_wait`. Handles timeout conversion with sub-millisecond rounding protection (L49-55) and safely sets event vector length.
- **register() (L73-83)**: Registers file descriptor with epoll using `EPOLL_CTL_ADD`. Converts Mio interests to epoll event flags.
- **reregister() (L86-96)**: Modifies existing registration using `EPOLL_CTL_MOD` (conditionally compiled).
- **deregister() (L98-101)**: Removes file descriptor using `EPOLL_CTL_DEL` (conditionally compiled).

### Interest Conversion
- **interests_to_epoll() (L120-136)**: Converts Mio Interest flags to epoll event mask. Always includes EPOLLET (edge-triggered) and maps readable/writable/priority interests to corresponding epoll constants.

### Event Analysis Module
- **event module (L141-229)**: Provides event inspection utilities:
  - **token() (L147-149)**: Extracts Token from epoll event
  - **is_readable/writable/error/priority() (L151-184)**: Event type checking functions
  - **is_read_closed/write_closed() (L164-180)**: Connection state detection using EPOLLHUP/EPOLLRDHUP
  - **is_aio/is_lio() (L186-194)**: Platform compatibility stubs (always false)
  - **debug_details() (L196-228)**: Debugging formatter for epoll events

## Type Aliases and Dependencies

- **Event/Events (L138-139)**: Type aliases for `libc::epoll_event` and `Vec<Event>`
- **Dependencies**: Uses libc for epoll syscalls, std::os::fd for file descriptor management, and crate-internal Interest/Token types
- **Conditional compilation**: Uses cfg macros for debug assertions and platform-specific features

## Architectural Patterns

- **RAII**: Proper file descriptor management through OwnedFd
- **Safety**: Unsafe blocks documented with safety invariants (L28, L69)
- **Debug support**: Atomic ID generation and comprehensive event debugging
- **Platform abstraction**: Conditional compilation for OS-specific features (Redox padding)
- **Error handling**: Consistent use of syscall! macro with io::Result returns
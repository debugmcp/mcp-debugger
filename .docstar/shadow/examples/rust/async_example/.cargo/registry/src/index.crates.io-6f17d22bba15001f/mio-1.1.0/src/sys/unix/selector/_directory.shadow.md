# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/unix/selector/
@generated: 2026-02-09T18:16:16Z

## Purpose and Responsibility

This directory implements Unix-specific I/O event selectors for the Mio library, providing platform-optimized asynchronous I/O multiplexing. It contains multiple selector backends (epoll, kqueue, poll) that abstract over different Unix system calls while presenting a unified interface for event-driven programming.

## Key Components and Architecture

### Selector Implementations

**epoll.rs**: Linux-optimized selector using epoll(7) system calls. Provides edge-triggered event notification with high-performance polling for Linux systems. Key features include automatic CLOEXEC handling, sub-millisecond timeout protection, and comprehensive event introspection.

**kqueue.rs**: BSD-family selector (FreeBSD, macOS, NetBSD, OpenBSD) using kqueue(2). Handles platform-specific type variations through conditional compilation and provides advanced features like user events for cross-thread waking. Includes special handling for macOS EPIPE quirks.

**poll.rs**: Portable fallback selector using POSIX poll(2). Implements thread-safe multi-producer single-consumer design with Arc-based sharing. Provides the most compatible but potentially least performant option across Unix systems.

**stateless_io_source.rs**: Zero-overhead I/O source wrapper for epoll/kqueue systems that don't require user-space state tracking. Uses unit struct pattern for minimal runtime cost.

### Common Interface Pattern

All selectors implement a consistent API surface:
- `new()`: Create selector instance with proper resource initialization
- `select(timeout)`: Main event polling loop with platform-optimized timeout handling  
- `register(fd, token, interests)`: Add file descriptor to event monitoring
- `reregister(fd, token, interests)`: Modify existing registration
- `deregister(fd)`: Remove file descriptor from monitoring
- `try_clone()`: Enable cross-thread selector sharing

### Event System

Each implementation provides an `event` module with standardized event introspection:
- `token()`: Extract user token from events
- `is_readable/writable/error()`: Event type classification
- `is_read_closed/write_closed()`: Connection state detection
- `debug_details()`: Comprehensive debugging output

## Public API Surface

**Primary Entry Points:**
- Selector structs exposing the core polling interface
- Event types for result processing  
- IoSourceState for I/O source lifecycle management
- Platform-specific type aliases (Event, Events, Filter, etc.)

**Internal Organization:**
- Platform detection through conditional compilation
- Shared patterns for timeout handling and error management
- Common event flag conversion utilities
- Consistent unsafe block documentation and safety invariants

## Data Flow and Integration

1. **Registration Phase**: I/O sources register file descriptors with platform-appropriate interest flags
2. **Polling Phase**: Selectors block on system calls waiting for events
3. **Event Processing**: Raw system events converted to Mio event format with token extraction
4. **Dispatch**: Events returned to user code through consistent iterator interface

## Important Patterns and Conventions

**Platform Abstraction**: Extensive use of cfg attributes to handle system differences while maintaining API compatibility

**Resource Management**: RAII patterns with OwnedFd for automatic cleanup and CLOEXEC by default

**Error Handling**: Consistent syscall! macro usage with io::Result returns; platform-specific error tolerance (EPIPE on macOS, ENOENT on deregistration)

**Thread Safety**: Arc-based sharing for poll selector; lock-free atomics where possible; careful race condition handling between registration and polling operations

**Performance Optimization**: Edge-triggered mode preference; batch operations; minimal syscall overhead; zero-copy event processing where possible

This directory serves as the core Unix backend for Mio's cross-platform event loop, with each selector optimized for its target platform while maintaining consistent semantics across implementations.
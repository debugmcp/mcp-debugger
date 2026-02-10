# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/unix/selector/stateless_io_source.rs
@source-hash: 25465ea28b12461e
@generated: 2026-02-09T17:58:14Z

## Purpose
Provides a stateless I/O source implementation for Unix systems using `kqueue(2)` and `epoll(2)`. This module implements a zero-state wrapper that delegates all operations directly to the underlying system selector without maintaining any user-space state.

## Key Components

### IoSourceState (L8)
A unit struct representing stateless I/O source state for Unix systems. Contains no fields as kqueue/epoll don't require user-space state management.

**Key Methods:**
- `new()` (L11-13): Creates new stateless instance, returns unit struct
- `do_io<T, F, R>()` (L15-22): Generic I/O operation executor that directly calls provided function without state management
- `register()` (L24-33): Registers file descriptor with registry selector, delegates to `registry.selector().register()`
- `reregister()` (L35-44): Reregisters file descriptor with new parameters, delegates to `registry.selector().reregister()`
- `deregister()` (L46-49): Removes file descriptor from registry, delegates to `registry.selector().deregister()`

## Dependencies
- `std::io`: For I/O error handling
- `std::os::fd::RawFd`: Unix file descriptor type
- `crate::{Interest, Registry, Token}`: Mio's core event system types

## Architectural Patterns
- **Stateless Delegation Pattern**: All methods are simple pass-throughs to the underlying registry selector
- **Zero-Cost Abstraction**: Unit struct with no runtime overhead
- **Platform Specialization**: Unix-specific implementation optimized for kqueue/epoll systems that don't need state tracking

## Key Invariants
- No state is maintained at the I/O source level
- All operations delegate directly to the registry's selector
- File descriptor lifecycle managed entirely by the underlying selector implementation
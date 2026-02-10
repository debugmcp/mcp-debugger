# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/async_fd.rs
@source-hash: f9cc49dda8716e39
@generated: 2026-02-09T18:06:47Z

## Primary Purpose

Unix-specific async file descriptor integration for Tokio's event loop. Provides `AsyncFd<T>` wrapper to make any `AsRawFd`-implementing type work with Tokio's reactor for edge-triggered readiness notifications.

## Core Types

### AsyncFd<T: AsRawFd> (L181-186)
Main wrapper struct that registers file descriptors with Tokio's reactor. Contains:
- `registration: Registration` - handles event loop integration  
- `inner: Option<T>` - wrapped FD object (Option for drop/move semantics)

Key invariant: Inner object's `as_raw_fd()` must return same FD throughout lifetime.

### AsyncFdReadyGuard<'a, T> (L194-197) 
`#[must_use]` guard returned by readiness methods. Provides immutable access to inner object and manages readiness state clearing. Contains reference to AsyncFd and optional ReadyEvent.

### AsyncFdReadyMutGuard<'a, T> (L205-208)
Mutable variant of ready guard, allows mutating inner object during IO operations.

## Key Methods

### Construction
- `new(inner: T)` (L226-231) - Creates AsyncFd with READ|WRITE interests
- `with_interest(inner, interest)` (L243-248) - Custom interest specification  
- `try_new()` variants (L277-318) - Non-panicking constructors returning Result

### Readiness Polling
- `poll_read_ready()` (L375-385) - Poll-style read readiness check
- `poll_write_ready()` (L451-461) - Poll-style write readiness check
- `ready(interest)` (L589-596) - Async wait for specified readiness
- `readable()` (L713-715) - Async wait for read readiness
- `writable()` (L751-753) - Async wait for write readiness

### IO Operations  
- `async_io(interest, closure)` (L850-858) - Async retry loop for IO operations
- `try_io(interest, closure)` (L902-909) - Single IO attempt with readiness management

### Guard Methods
- `clear_ready()` (L969-973, L1193-1197) - Clear all readiness flags
- `clear_ready_matching(ready)` (L1058-1071, L1282-1295) - Clear specific readiness
- `try_io(closure)` (L1151-1164, L1336-1349) - Execute IO with automatic readiness clearing
- `retain_ready()` (L1078-1080, L1302-1304) - No-op to satisfy must_use

## Dependencies

- `crate::io::{Interest, Ready}` - Readiness types
- `crate::runtime::io::{ReadyEvent, Registration}` - Event loop integration
- `mio::unix::SourceFd` - Platform FD abstraction
- Standard Unix FD traits (`AsRawFd`, `AsFd`)

## Usage Pattern

1. Wrap FD object with `AsyncFd::new()`
2. Set FD to non-blocking mode  
3. Use `readable()`/`writable()` to wait for readiness
4. Execute IO operations via guard's `try_io()` or direct access
5. Guard automatically manages readiness state based on WouldBlock errors

## Error Types

- `TryIoError` (L1395) - Indicates WouldBlock occurred in try_io
- `AsyncFdTryNewError<T>` (L1401-1404) - Constructor failure with original object recovery

## Critical Design Notes

- Edge-triggered notifications require proper readiness clearing after WouldBlock
- Guards are `#[must_use]` to prevent forgetting readiness management
- Only one task can poll each direction (read/write) with poll_* methods
- Multiple tasks can use async methods (readable/writable) concurrently
- File descriptor must remain stable throughout AsyncFd lifetime
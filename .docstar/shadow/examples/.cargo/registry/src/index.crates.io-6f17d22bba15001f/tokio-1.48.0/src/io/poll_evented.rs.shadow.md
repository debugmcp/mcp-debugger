# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/poll_evented.rs
@source-hash: d2db7b49deee36eb
@generated: 2026-02-09T18:06:39Z

## Purpose
PollEvented bridges sync I/O types implementing mio::event::Source with tokio's async reactor system, providing AsyncRead/AsyncWrite capabilities through event-driven readiness notifications.

## Core Structure
- **PollEvented<E: Source>** (L66-69): Wrapper containing optional I/O resource and Registration for reactor integration
- Fields: `io: Option<E>` and `registration: Registration`
- Uses conditional compilation via `cfg_io_driver!` macro

## Key Methods

### Construction (L74-125)
- **new()** (L89-91): Creates with read/write interest, delegates to `new_with_interest`
- **new_with_interest()** (L110-112): Creates with custom Interest flags
- **new_with_interest_and_handle()** (L115-125): Core constructor taking scheduler handle

### Resource Management (L129-150)
- **registration()** (L129-131): Returns Registration reference (net/process features)
- **into_inner()** (L135-139): Deregisters and extracts inner I/O resource
- **reregister()** (L143-150): Re-registers with new interest under current runtime (Linux process feature)

### Async I/O Operations (L159-269, feature-gated)
- **poll_read()** (L161-226): Unsafe async read with platform-specific optimizations
  - Uses readiness polling loop with `registration.poll_read_ready()`
  - Handles WouldBlock by clearing readiness
  - Platform-specific buffer draining optimization (L190-212) for epoll/kqueue systems
- **poll_write()** (L228-255): Async write with similar readiness management
- **poll_write_vectored()** (L258-268): Vectored write using Registration helper

## Architectural Patterns

### Readiness Management
Uses Registration pattern where:
1. Poll for readiness events
2. Attempt I/O operation
3. Clear readiness on WouldBlock to await new events
4. Platform-specific optimizations avoid unnecessary readiness clearing

### Memory Safety
- Unsafe `poll_read` requires caller to ensure E can read into uninitialized memory
- Uses MaybeUninit pointer casting for uninitialized buffer access (L174)

### Error Handling
- WouldBlock errors trigger readiness clearing and retry
- Other errors propagate immediately
- Drop impl (L290-297) ignores deregistration errors

## Dependencies
- mio::event::Source for event integration
- crate::runtime::io::Registration for reactor communication
- crate::runtime::scheduler for handle management
- Feature-gated functionality for net/process support

## Concurrency Constraints
Critical invariant: At most 2 concurrent tasks per instance (one reader, one writer) to prevent lost notifications and task hanging.

## Trait Implementations
- Deref to inner E type (L276-282)
- Debug, UnwindSafe, RefUnwindSafe
- Drop handles deregistration cleanup
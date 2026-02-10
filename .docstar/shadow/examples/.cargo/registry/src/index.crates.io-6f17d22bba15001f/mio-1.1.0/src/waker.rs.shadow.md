# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/waker.rs
@source-hash: cd521418aede7036
@generated: 2026-02-09T18:11:36Z

## Purpose
Cross-thread event notification system allowing threads to wake up a `Poll` instance from external contexts. Part of the mio async I/O library's event notification infrastructure.

## Key Components

**Waker struct (L77-80)**
- Wraps platform-specific `sys::Waker` implementation
- Enables cross-thread communication with event loops
- Single waker per `Poll` instance constraint

**new() constructor (L84-88)**
- Creates waker registered with specific `Registry` and `Token`
- Debug mode includes waker registration tracking (L85-86)
- Delegates to platform-specific `sys::Waker::new()`

**wake() method (L93-95)**
- Triggers readable event on associated `Poll` with registered token
- Thread-safe operation for cross-thread signaling
- Returns `io::Result<()>` for error handling

## Dependencies
- `crate::sys`: Platform-specific waker implementations
- `crate::Registry`: Event registration system
- `crate::Token`: Event identification system
- `std::io`: Error handling

## Architecture Patterns
- **Platform Abstraction**: Uses `sys::Waker` for OS-specific implementations (kqueue on BSD/macOS, eventfd on Linux)
- **RAII Wrapper**: Thin wrapper around system-specific waker with automatic cleanup
- **Token-based Events**: Associates wake events with specific tokens for multiplexing

## Critical Constraints
- Only one `Waker` per `Poll` instance (L19-22)
- Waker lifetime must exceed usage period for guaranteed event delivery (L16-17)
- Thread-safe sharing requires `Arc` wrapper (example L51)
- Multiple wakers with same `Poll` results in unspecified behavior

## Implementation Notes
- Uses EVFILT_USER on kqueue platforms (BSD/macOS)
- Uses eventfd(2) on Linux
- Debug builds track waker registration for validation
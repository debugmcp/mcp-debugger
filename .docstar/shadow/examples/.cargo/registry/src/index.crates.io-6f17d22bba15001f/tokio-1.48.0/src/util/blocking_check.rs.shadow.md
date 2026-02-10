# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/blocking_check.rs
@source-hash: c1b5cab1a7590d5c
@generated: 2026-02-09T18:06:47Z

## Purpose
Utility module providing platform-specific socket blocking status validation for Tokio runtime integration. Prevents registration of blocking sockets with the async runtime, which would cause performance issues.

## Key Functions

### `check_socket_for_blocking<S: AsFd>` (Unix - L7-21)
- **Purpose**: Validates that a socket is in non-blocking mode before registration with Tokio runtime
- **Parameters**: Generic socket `s` that implements `AsFd` trait
- **Returns**: `crate::io::Result<()>`
- **Behavior**: 
  - Uses `socket2::SockRef` to check socket's non-blocking status (L10)
  - Fails with debug assertion if socket is blocking (L12-17)
  - Can be bypassed with `tokio_allow_from_blocking_fd` cfg flag (L8)
- **Error Context**: References GitHub issue #7172 for blocking socket problems

### `check_socket_for_blocking<S>` (Non-Unix - L25-29)
- **Purpose**: No-op implementation for Windows/WASI platforms
- **Limitation**: Cannot retrieve non-blocking status on these platforms (L26-27)
- **Always returns**: `Ok(())`

## Platform Handling
- **Unix**: Full validation using file descriptor interface
- **Windows/WASI**: No validation (limitation acknowledged in comment)

## Configuration
- **Feature Flag**: `tokio_allow_from_blocking_fd` - disables validation when set
- **Caller Tracking**: `#[track_caller]` on Unix version for better debug info

## Dependencies
- `std::os::fd::AsFd` (Unix only)
- `socket2::SockRef` for socket introspection
- Tokio's internal error types (`crate::io::Result`)
# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/unix/waker/eventfd.rs
@source-hash: 322d3fb6c322b556
@generated: 2026-02-09T17:58:17Z

## Purpose
Implements an `eventfd`-based waker mechanism for Unix-like systems in the MIO asynchronous I/O library. This provides a thread-safe way to wake up event loops by leveraging Linux's eventfd system call as a 64-bit counter.

## Core Components

### Waker Struct (L20-22)
- Single field: `fd: File` - wraps the eventfd file descriptor
- Implements `Debug` and `AsRawFd` traits

### Constructor Methods
- `new()` (L26-30): Creates registered waker with selector and token for event loop integration
- `new_unregistered()` (L32-41): Creates standalone waker using `eventfd(0, flags)` system call
  - Platform-specific flag handling: EFD_CLOEXEC|EFD_NONBLOCK for most systems, special case for ESP-IDF (L36-37)

### Core Operations
- `wake()` (L44-63): Writes 1u64 as 8 bytes to increment eventfd counter
  - Handles counter overflow by resetting and retrying (L55-60)
  - Special illumos workaround: pre-emptive reset for edge-triggered events (L49-50)
- `reset()` (L72-81): Reads 8 bytes to reset counter to 0, ignores WouldBlock errors
- `ack_and_reset()` (L66-68): Public wrapper for reset, used by poll(2) implementation

## Platform Adaptations
- Hermit OS: Uses specialized fd traits (L7-8)
- ESP-IDF: Omits EFD_NONBLOCK flag (already default)
- illumos: Requires reset before wake due to epoll emulation issues

## Key Dependencies
- `crate::sys::Selector` for event loop registration
- `crate::{Interest, Token}` for event system integration
- Platform-specific fd traits and libc constants

## Architecture Notes
- Uses `syscall!` macro for eventfd creation (L38)
- Allows partial I/O operations (clippy allowances on L43, L71)
- Dead code allowances indicate conditional compilation based on backend (poll vs epoll)
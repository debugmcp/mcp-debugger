# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/unix/datagram/
@generated: 2026-02-09T18:16:05Z

## Purpose

This directory implements Unix domain datagram socket functionality for Tokio's networking layer. It provides async, non-blocking I/O operations for connectionless inter-process communication on Unix systems, wrapping the underlying `mio` implementation with Tokio's async runtime integration.

## Key Components

**Module Organization:**
- `mod.rs`: Entry point that exposes the internal `socket` module with `pub(crate)` visibility
- `socket.rs`: Contains the complete `UnixDatagram` implementation

**Core Component:**
- `UnixDatagram`: Main async wrapper struct built around `PollEvented<mio::net::UnixDatagram>` for registration-based I/O

## Public API Surface

**Socket Creation:**
- `bind(path)`: Create socket bound to filesystem path
- `pair()`: Create unnamed connected socket pair 
- `unbound()`: Create unbound socket for client connections
- `from_std()`: Convert from standard library UnixDatagram

**Async I/O Operations:**
- `send()`/`recv()`: Connected peer communication
- `send_to()`/`recv_from()`: Address-specified communication
- `try_send()`/`try_recv()`: Non-blocking variants
- Buffer-aware operations for efficient memory management

**Readiness Management:**
- `ready()`, `readable()`, `writable()`: Await specific readiness states
- `poll_*` family: Direct polling interface for custom async implementations

## Internal Organization

The directory follows Tokio's standard async networking pattern:

1. **Module Structure**: Simple aggregator pattern where `mod.rs` exposes internal implementation while maintaining API boundaries
2. **Async Integration**: All operations use `PollEvented` wrapper for seamless runtime integration
3. **Readiness-Driven I/O**: Registration-based model where operations await readiness before attempting I/O
4. **Error Handling**: Proper `WouldBlock` handling for spurious readiness events

## Data Flow

```
User API Call → Readiness Check → Try Operation → Handle WouldBlock/Success
                     ↑                               ↓
                Runtime Notification ← mio Polling
```

## Important Patterns

- **Shared Ownership**: All methods take `&self`, enabling `Arc`-based sharing without mutexes
- **Cancel Safety**: Async operations designed to be cancellation-safe
- **Buffer Management**: Optional buffer-aware operations for zero-copy scenarios
- **Interoperability**: Seamless conversion between std/mio/tokio socket types

This module serves as Tokio's primary interface for Unix datagram sockets, abstracting the complexity of non-blocking I/O while providing both high-level async APIs and low-level polling interfaces for advanced use cases.
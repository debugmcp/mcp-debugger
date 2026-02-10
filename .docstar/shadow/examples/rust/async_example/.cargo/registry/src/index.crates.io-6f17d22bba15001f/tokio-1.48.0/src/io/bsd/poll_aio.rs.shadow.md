# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/bsd/poll_aio.rs
@source-hash: 047c48609daf5a5b
@generated: 2026-02-09T18:02:45Z

## Purpose
FreeBSD-specific POSIX AIO integration with Tokio's async reactor system, providing async wrappers for AIO operations using kqueue notifications.

## Key Components

### AioSource trait (L20-26)
- Defines interface for AIO event sources that can be registered with Tokio's reactor
- `register()` (L22): Associates AIO source with kqueue file descriptor and token
- `deregister()` (L25): Removes AIO source from reactor

### MioSource<T> wrapper (L30, L32-59) 
- Private adapter implementing `mio::event::Source` for `AioSource` types
- Bridges AioSource interface to mio's event system
- Validates that interests are AIO or LIO specific (L39, L55)
- `reregister()` delegates to `register()` (L49-58)

### Aio<E> struct (L90-93)
Main async wrapper for POSIX AIO operations:
- `io`: Wrapped MioSource containing the AIO source
- `registration`: Tokio reactor registration for event handling

### Aio Implementation (L97-171)
**Constructors:**
- `new_for_aio()` (L104-106): Creates Aio for standard AIO operations
- `new_for_lio()` (L116-118): Creates Aio for lio_listio batch operations
- `new_with_interest()` (L120-125): Internal constructor with Interest parameter

**Core Methods:**
- `poll_ready()` (L167-170): Polls for AIO completion, returns `Poll<io::Result<AioEvent>>`
- `clear_ready()` (L144-146): Clears readiness flag for reuse scenarios
- `into_inner()` (L149-151): Consumes wrapper and returns inner source

### AioEvent (L196-197)
Opaque wrapper around `ReadyEvent` for type safety in clear_ready operations.

## Dependencies
- `mio`: Event loop and registry integration
- `crate::runtime::io`: Tokio's Registration system
- `crate::io::interest::Interest`: AIO-specific interest types

## Architecture Notes
- FreeBSD-only implementation (kqueue + POSIX AIO)
- Edge-triggered readiness model requiring careful `clear_ready()` usage
- AIO events register via aio_read/aio_write syscalls, not kevent(2)
- No Drop implementation needed - dropping automatically deregisters
- Supports both single AIO operations and lio_listio batch operations

## Critical Invariants
- `clear_ready()` must only be called when source is genuinely not ready
- Interest validation enforces AIO/LIO-only usage
- Registration tied to current scheduler handle context
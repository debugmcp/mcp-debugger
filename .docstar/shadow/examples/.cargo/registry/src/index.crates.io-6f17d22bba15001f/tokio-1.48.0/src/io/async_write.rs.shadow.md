# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/async_write.rs
@source-hash: 40bd602cd9d17d71
@generated: 2026-02-09T18:06:38Z

## Primary Purpose
Core definition of Tokio's asynchronous write trait and standard implementations. Provides the fundamental polling-based interface for non-blocking write operations in async I/O contexts.

## Key Components

### AsyncWrite Trait (L45-183)
Primary trait defining asynchronous write operations with four core methods:
- `poll_write` (L58-62): Attempts to write bytes from buffer, returns `Poll<Result<usize, io::Error>>`
- `poll_flush` (L73): Ensures buffered data reaches destination
- `poll_shutdown` (L133): Graceful shutdown with implicit flush semantics
- `poll_write_vectored` (L158-168): Vectored write with default implementation delegating to first non-empty buffer
- `is_write_vectored` (L180-182): Performance hint returning `false` by default

Critical constraint: All methods must be called within async task context or may panic.

### Delegation Macro (L185-215)
`deref_async_write!` macro generates boilerplate implementations that delegate through `Pin::new(&mut **self)` for wrapper types.

### Standard Implementations

#### Smart Pointer Wrappers (L217-257)
- `Box<T: AsyncWrite + Unpin>` (L217-219): Uses delegation macro
- `&mut T` (L221-223): Uses delegation macro  
- `Pin<P>` where `P::Target: AsyncWrite` (L225-257): Uses `crate::util::pin_as_deref_mut`

#### Memory-Based Writers
- `Vec<u8>` (L259-288): Always-ready writer that appends data, supports vectored writes
- `io::Cursor<&mut [u8]>` (L290-318): Fixed-size buffer writer
- `io::Cursor<&mut Vec<u8>>` (L320-348): Growable cursor over Vec reference
- `io::Cursor<Vec<u8>>` (L350-378): Owned cursor over Vec
- `io::Cursor<Box<[u8]>>` (L380-408): Fixed-size boxed slice cursor

## Architectural Patterns
- **Poll-based async**: All operations return `Poll<T>` for cooperative scheduling
- **Pin safety**: Methods take `Pin<&mut Self>` for self-referential safety
- **Delegation strategy**: Smart pointers consistently delegate to underlying type
- **Ready-by-default**: Memory-based implementations return `Poll::Ready` immediately
- **Vectored optimization**: Memory types support efficient multi-buffer writes

## Dependencies
- `std::io::{IoSlice, Write}` for I/O primitives
- `std::task::{Context, Poll}` for async task system
- `crate::util::pin_as_deref_mut` for Pin manipulation utilities

## Critical Invariants
- `poll_shutdown` implies `poll_flush` - shutdown always flushes pending data
- Vectored writes must be atomic - partial success not allowed
- All operations must be non-blocking and return `Poll::Pending` when would block
- Task context requirement enforced for proper waker notification
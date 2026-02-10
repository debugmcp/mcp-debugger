# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/unix/split.rs
@source-hash: 3f0b9c74481a5369
@generated: 2026-02-09T18:03:02Z

## Purpose
Provides zero-cost splitting functionality for Unix domain streams into separate read and write halves, maintaining all invariants at the type level without runtime overhead.

## Key Structures

**ReadHalf<'a> (L33)**: Borrowed read-only half of a UnixStream
- Wraps `&'a UnixStream` reference
- Implements `AsyncRead` trait (L281-289)
- Provides non-blocking read operations and readiness checking

**WriteHalf<'a> (L49)**: Borrowed write-only half of a UnixStream  
- Wraps `&'a UnixStream` reference
- Implements `AsyncWrite` trait (L291-319)
- Handles write operations and proper shutdown semantics

## Core Functions

**split() (L51-53)**: Creates read/write halves from mutable UnixStream reference
- Returns `(ReadHalf, WriteHalf)` tuple
- Both halves share the same underlying stream reference

## ReadHalf Methods (L55-187)
- **ready()/readable() (L79-96)**: Async readiness notification with cancel safety
- **try_read() (L121-123)**: Non-blocking read with `WouldBlock` semantics
- **try_read_buf() (L144-146)**: BufMut-based read (conditionally compiled)
- **try_read_vectored() (L174-176)**: Scatter-gather read operation
- **peer_addr()/local_addr() (L179-186)**: Socket address accessors

## WriteHalf Methods (L189-279)
- **ready()/writable() (L213-230)**: Async write readiness with cancel safety
- **try_write() (L245-247)**: Non-blocking write with partial write support
- **try_write_vectored() (L266-268)**: Gather write operation
- **peer_addr()/local_addr() (L271-278)**: Socket address accessors

## Trait Implementations

**AsyncRead for ReadHalf (L281-289)**: Delegates to `UnixStream::poll_read_priv()`

**AsyncWrite for WriteHalf (L291-319)**:
- Delegates write operations to `UnixStream::poll_write_priv()` methods
- `poll_flush()` returns immediate success (L312-314)
- `poll_shutdown()` calls `shutdown_std(Shutdown::Write)` (L316-318)

**AsRef<UnixStream> (L321-331)**: Both halves provide access to underlying stream

## Dependencies
- `crate::io::{AsyncRead, AsyncWrite, Interest, ReadBuf, Ready}`
- `crate::net::{UnixStream, unix::SocketAddr}`
- Conditional `bytes::BufMut` for buffer operations

## Architecture Notes
- Zero-cost abstraction: no additional fields or runtime overhead
- Type-safe separation: compile-time enforcement of read/write boundaries  
- Lifetime-bound: halves cannot outlive the original stream
- Cancel-safe async operations with proper `WouldBlock` handling
- Vectored I/O support for efficient scatter-gather operations
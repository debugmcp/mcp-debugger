# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/tcp/split.rs
@source-hash: 6dd5cfdae68c1608
@generated: 2026-02-09T18:03:03Z

## Primary Purpose
Provides specialized split functionality for `TcpStream` into separate read and write halves without allocation overhead. Enables concurrent reading and writing on different async tasks by borrowing the same underlying stream.

## Key Types

### ReadHalf (L33)
Borrowed read-only reference to a TcpStream created by splitting. Implements `AsyncRead` trait (L370-378).

**Key Methods:**
- `poll_peek(cx, buf)` (L90-96) - Non-blocking peek at incoming data without consuming it
- `peek(buf)` (L137-140) - Async version of poll_peek using poll_fn
- `ready(interest)` (L165-167) - Waits for specified readiness states
- `readable()` (L182-184) - Waits for socket to become readable
- `try_read(buf)` (L209-211) - Non-blocking read attempt
- `try_read_vectored(bufs)` (L238-240) - Vectored non-blocking read
- `try_read_buf(buf)` (L262-264) - Read into BufMut (conditionally compiled)
- `peer_addr()` (L268-270) / `local_addr()` (L273-275) - Address accessors

### WriteHalf (L49) 
Borrowed write-only reference to a TcpStream. Implements `AsyncWrite` trait (L380-411).

**Key Methods:**
- `ready(interest)` (L302-304) - Waits for specified readiness states  
- `writable()` (L317-319) - Waits for socket to become writable
- `try_write(buf)` (L334-336) - Non-blocking write attempt
- `try_write_vectored(bufs)` (L355-357) - Vectored non-blocking write
- `peer_addr()` (L360-362) / `local_addr()` (L365-367) - Address accessors

## Core Functions

### split(stream) (L51-53)
Creates ReadHalf and WriteHalf by borrowing the same TcpStream reference. Zero-cost operation that returns tuple of split halves.

## Dependencies
- `crate::io::{AsyncRead, AsyncWrite, Interest, ReadBuf, Ready}` (L11)
- `crate::net::TcpStream` (L12)
- `std::future::poll_fn`, `std::io`, `std::net::{Shutdown, SocketAddr}` (L14-16)
- `bytes::BufMut` (L21) - Conditional compilation for io_util feature

## Implementation Details

### AsyncRead Implementation (L370-378)
ReadHalf delegates to underlying TcpStream's `poll_read_priv` method.

### AsyncWrite Implementation (L380-411)
WriteHalf delegates write operations to TcpStream's private methods:
- `poll_write_priv` for writing
- `poll_write_vectored_priv` for vectored writes
- `poll_flush` is no-op for TCP (L402-405)
- `poll_shutdown` calls `shutdown_std(Shutdown::Write)` (L408-410)

### AsRef Implementations (L413-423)
Both halves provide AsRef<TcpStream> to access underlying stream reference.

## Architectural Patterns
- Zero-cost abstraction: Split operation creates borrows without allocation
- Type-safe enforcement: Read/write separation enforced at compile time
- Delegation pattern: All operations delegate to underlying TcpStream
- Lifetime management: Both halves tied to original stream's lifetime via `'a` parameter

## Critical Invariants
- Both halves reference the same underlying TcpStream
- Split operation preserves all TcpStream functionality through delegation
- Shutdown on WriteHalf only affects write direction of the stream
- All readiness and I/O operations maintain non-blocking semantics
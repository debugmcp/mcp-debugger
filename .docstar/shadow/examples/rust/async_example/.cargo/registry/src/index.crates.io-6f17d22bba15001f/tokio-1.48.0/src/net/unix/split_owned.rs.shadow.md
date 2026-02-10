# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/unix/split_owned.rs
@source-hash: 5eccba5c1d589af4
@generated: 2026-02-09T18:03:05Z

## Purpose

Provides owned split functionality for Unix domain sockets, allowing a `UnixStream` to be split into separate read and write halves with zero-overhead Arc-based sharing and type-level invariant enforcement.

## Key Structures

### OwnedReadHalf (L34-37)
Read-only half of a split Unix stream containing an `Arc<UnixStream>`. Implements `AsyncRead` and provides non-blocking read operations.

### OwnedWriteHalf (L53-57)
Write-only half containing `Arc<UnixStream>` and `shutdown_on_drop` flag. Implements `AsyncWrite` with automatic write-side shutdown on drop unless explicitly prevented.

### ReuniteError (L85-99)
Error type returned when attempting to reunite halves from different original streams. Contains the failed halves for recovery.

## Core Functions

### split_owned (L59-69)
Creates owned read/write halves from a `UnixStream` by wrapping in `Arc` and cloning for the read half. Write half gets `shutdown_on_drop: true`.

### reunite (L71-83)
Attempts to reunite read/write halves by comparing Arc pointers. Uses `Arc::try_unwrap` after calling `forget()` on write half to prevent shutdown.

## Key Methods

### OwnedReadHalf
- `reunite()` (L107-109): Reunites with write half
- `ready()/readable()` (L134-151): Async readiness checking  
- `try_read()` variants (L176-232): Non-blocking read operations
- `peer_addr()/local_addr()` (L234-242): Socket address queries
- `AsyncRead` implementation (L245-253): Delegates to inner stream's private method

### OwnedWriteHalf  
- `reunite()` (L261-263): Reunites with read half
- `forget()` (L268-271): Disables shutdown-on-drop behavior
- `ready()/writable()` (L296-313): Async write readiness
- `try_write()` variants (L328-351): Non-blocking write operations
- `peer_addr()/local_addr()` (L353-361): Socket address queries
- `AsyncWrite` implementation (L372-407): Includes automatic write shutdown
- `Drop` implementation (L364-370): Conditionally shuts down write side

## Dependencies

- `crate::io::{AsyncRead, AsyncWrite, Interest, ReadBuf, Ready}`: Core async I/O traits
- `crate::net::UnixStream`: The underlying Unix domain socket
- `std::sync::Arc`: Reference counting for zero-copy splitting
- `bytes::BufMut`: Optional buffer utilities under `cfg_io_util`

## Architectural Decisions

- Uses `Arc` for zero-overhead sharing between halves
- Type-safe reunification through pointer equality checking
- Automatic write-side shutdown on drop with opt-out via `forget()`
- All I/O operations delegate to inner `UnixStream` private methods
- Maintains socket address query capabilities on both halves
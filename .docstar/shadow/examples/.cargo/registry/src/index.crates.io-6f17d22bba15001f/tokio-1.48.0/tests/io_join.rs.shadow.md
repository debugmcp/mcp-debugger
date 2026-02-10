# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_join.rs
@source-hash: 2ad74bbac6475823
@generated: 2026-02-09T18:12:14Z

**Test file for Tokio's `io::join` functionality**

This test file validates the behavior of `tokio::io::join()`, which combines separate AsyncRead and AsyncWrite implementations into a single object that implements both traits.

## Primary Components

**Mock Reader `R` (L10-21)**: Simple AsyncRead implementation that always returns the byte 'z' immediately via `Poll::Ready`. Used as a test fixture for read operations.

**Mock Writer `W` (L23-53)**: AsyncWrite implementation with predictable behavior:
- `poll_write()` always returns `Ok(1)` immediately
- `poll_write_vectored()` always returns `Ok(2)` 
- `is_write_vectored()` returns `true`
- `poll_flush()` and `poll_shutdown()` succeed immediately

## Test Coverage

**Send/Sync Bounds Test (L55-60)**: Compile-time verification that `Join<W, R>` implements `Send + Sync` traits, ensuring thread safety.

**Method Delegation Test (L62-81)**: Runtime verification that the joined object properly delegates:
- Read operations to the reader component (returns 'z')
- Write operations to the writer component (returns expected sizes)
- Vectored write operations and capability detection
- Flush and shutdown operations

## Key Dependencies
- `tokio::io::{join, AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt, Join, ReadBuf}`
- `tokio_test::block_on` for async test execution
- Standard library I/O traits and utilities

## Architecture Notes
The test demonstrates that `Join` acts as a transparent wrapper, forwarding method calls to the appropriate underlying implementation without modification. The mock implementations use immediate `Poll::Ready` responses to avoid async complexity in tests.
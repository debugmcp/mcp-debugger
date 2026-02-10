# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_split.rs
@source-hash: 20f877649da2c5af
@generated: 2026-02-09T18:12:22Z

## Purpose
Test suite for `tokio::io::split` functionality, verifying that I/O streams can be split into separate read/write halves and properly recombined. Focuses on testing split stream pairing semantics, unsplit operations, and method delegation.

## Key Components

### Test Mock: RW struct (L12-53)
- **RW (L12)**: Mock implementation of both `AsyncRead` and `AsyncWrite` traits for testing
- **AsyncRead impl (L14-23)**: Always returns byte 'z' immediately via `Poll::Ready`
- **AsyncWrite impl (L25-53)**: Returns fixed success values:
  - `poll_write`: Always accepts 1 byte (L26-32)
  - `poll_write_vectored`: Always accepts 2 bytes (L42-48)
  - `poll_flush`/`poll_shutdown`: Always succeed immediately (L34-40)
  - `is_write_vectored`: Returns true (L50-52)

### Core Test Functions

#### **is_send_and_sync (L55-61)**
Compile-time test ensuring `ReadHalf<RW>` and `WriteHalf<RW>` implement `Send + Sync` traits for thread safety.

#### **split_stream_id (L63-71)**
Tests stream pairing identification using `is_pair_of()` method:
- Verifies read/write halves from same split are paired
- Confirms halves from different splits are not paired

#### **unsplit_ok (L73-77)**
Tests successful reunification of properly paired read/write halves.

#### **unsplit_err1/unsplit_err2 (L79-93)**
Panic tests (`#[should_panic]`) verifying that mismatched read/write halves cannot be unsplit:
- `unsplit_err1`: Reader from first split + writer from second split
- `unsplit_err2`: Writer from first split + reader from second split

#### **method_delegation (L95-114)**
Integration test verifying that split halves properly delegate to underlying stream methods:
- Tests async read operations return expected data ('z')
- Tests async write operations return expected byte counts (1 for write, 2 for write_vectored)
- Verifies flush and shutdown operations complete successfully
- Uses `tokio_test::block_on` for async execution

## Dependencies
- **tokio::io**: Core async I/O traits and split functionality
- **tokio_test**: Test utilities for async code execution
- **std::io**, **std::pin**, **std::task**: Standard library async primitives

## Architecture Notes
- Tests are platform-conditional: excluded on WASI due to panic recovery limitations (L2)
- Mock implementation provides deterministic behavior for reliable testing
- Panic tests ensure split/unsplit safety invariants are enforced at runtime
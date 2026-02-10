# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_copy.rs
@source-hash: eb0108f18eb01ee3
@generated: 2026-02-09T18:12:16Z

## Test suite for tokio::io::copy functionality

Tests the async copy operation between readers and writers in the tokio async runtime. Contains three test scenarios covering basic functionality, buffered writing, and cooperative scheduling behavior.

### Key Components

**Rd struct (L13-29)**: Simple test reader that implements AsyncRead. Returns "hello world" bytes on first read, then EOF. Used to test basic copy operation with known data.

**BufferedWd struct (L41-70)**: Buffered async writer wrapping a DuplexStream. Implements AsyncWrite with:
- `poll_write` (L47-54): Buffers incoming data in BytesMut buffer
- `poll_flush` (L56-65): Drains buffer to underlying writer using ready! macro
- `poll_shutdown` (L67-69): Delegates shutdown to underlying writer

### Test Cases

**copy test (L11-37)**: Basic functionality test. Creates Rd reader with "hello world" data and Vec writer. Verifies io::copy transfers exactly 11 bytes and preserves data integrity.

**proxy test (L39-86)**: Advanced buffered I/O test. Sets up duplex stream with 1024-byte capacity, wraps writer side in BufferedWd, writes initial 512 bytes, then copies remaining data. Tests buffer management and full data transfer (1024 bytes total).

**copy_is_cooperative test (L88-101)**: Concurrency test using tokio::select! with biased selection. Runs infinite copy loop in one branch against yield_now() in another to verify copy operation yields control cooperatively and doesn't block the runtime scheduler.

### Dependencies

- tokio::io traits (AsyncRead, AsyncWrite, AsyncReadExt, AsyncWriteExt, ReadBuf)
- bytes::BytesMut for buffering
- tokio_test::assert_ok for test assertions
- std::pin::Pin, std::task for async implementation

### Architecture Notes

Tests validate both streaming I/O patterns and cooperative async behavior. BufferedWd demonstrates proper async writer implementation with flush semantics. The cooperative test ensures copy operations don't monopolize the async runtime.
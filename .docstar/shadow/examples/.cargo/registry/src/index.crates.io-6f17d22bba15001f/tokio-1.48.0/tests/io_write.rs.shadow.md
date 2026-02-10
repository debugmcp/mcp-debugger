# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_write.rs
@source-hash: 98668a8c8feae0f8
@generated: 2026-02-09T18:12:19Z

## Primary Purpose
Test suite for Tokio's AsyncWrite trait and AsyncWriteExt extension methods, validating both custom implementations and standard library integrations.

## Key Components

### Test Functions
- **`write()` (L12-47)**: Tests custom AsyncWrite implementation with partial write semantics
- **`write_cursor()` (L49-58)**: Tests AsyncWrite integration with std::io::Cursor

### Mock Implementation
- **`Wr` struct (L14-17)**: Test mock implementing AsyncWrite
  - `buf: BytesMut`: Buffer for capturing written data
  - `cnt: usize`: Counter field (currently unused in implementation)

### AsyncWrite Implementation (L19-37)
- **`poll_write()` (L20-28)**: Always writes exactly 4 bytes regardless of input size, validates cnt=0
- **`poll_flush()` (L30-32)**: No-op implementation returning immediate success
- **`poll_shutdown()` (L34-36)**: No-op implementation returning immediate success

## Dependencies
- `tokio::io::{AsyncWrite, AsyncWriteExt}`: Core async I/O traits
- `tokio_test::assert_ok`: Test assertion macro
- `bytes::BytesMut`: Efficient byte buffer
- `std::io::Cursor`: Standard library cursor wrapper

## Test Patterns
1. **Partial Write Testing**: Wr mock demonstrates writers that accept less data than provided
2. **Buffer Verification**: Direct buffer content validation after writes
3. **Return Value Testing**: Validates correct byte count returns from write operations

## Architectural Notes
- Uses Pin<&mut Self> for safe async operation
- Poll-based interface following Rust async conventions
- Tests both custom and standard library AsyncWrite implementations
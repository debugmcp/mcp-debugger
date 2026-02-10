# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/read_int.rs
@source-hash: 877149e10515b1a1
@generated: 2026-02-09T18:02:51Z

## Purpose
Defines async futures for reading fixed-size integer and float values from AsyncRead streams in Tokio. Provides both big-endian (default) and little-endian variants for multi-byte types.

## Core Components

### reader! macro (L12-78)
Generates futures for reading multi-byte numeric types (u16, u32, u64, u128, i16, i32, i64, i128, f32, f64):
- Creates pinned future struct with internal buffer `buf: [u8; N]` and read progress tracker `read: u8`
- Implements incremental reading: accumulates bytes until complete value is read
- Uses `bytes::Buf` trait methods (e.g., `get_u16`, `get_u32_le`) for endianness conversion
- Returns `Poll::Ready(Err(UnexpectedEof))` if stream ends before complete value is read

### reader8! macro (L80-129)
Specialized macro for single-byte types (u8, i8):
- Simpler implementation without internal buffer accumulation
- Reads directly into single-byte buffer
- Immediate conversion to target type without endianness considerations

### Generated Future Types (L131-158)
**Big-endian readers:** ReadU16, ReadU32, ReadU64, ReadU128, ReadI16, ReadI32, ReadI64, ReadI128, ReadF32, ReadF64
**Little-endian readers:** ReadU16Le, ReadU32Le, ReadU64Le, ReadU128Le, ReadI16Le, ReadI32Le, ReadI64Le, ReadI128Le, ReadF32Le, ReadF64Le
**Single-byte readers:** ReadU8, ReadI8

## Key Dependencies
- `crate::io::{AsyncRead, ReadBuf}` - Core async I/O traits
- `bytes::Buf` - Provides endianness-aware parsing methods
- `pin_project_lite::pin_project` - Safe pinned projection for futures

## Architecture Patterns
- **Macro-generated code**: Reduces boilerplate for similar future implementations
- **Incremental reading**: Handles partial reads gracefully by tracking progress
- **Pin safety**: Uses `PhantomPinned` to ensure futures work with async trait methods
- **Zero-copy parsing**: Uses `bytes::Buf` trait for efficient endianness conversion

## Critical Invariants
- All generated futures are `!Unpin` for async trait compatibility
- Reading continues until exactly `size_of::<T>()` bytes are accumulated
- EOF before complete read always results in `UnexpectedEof` error
- Buffer size matches target type size exactly
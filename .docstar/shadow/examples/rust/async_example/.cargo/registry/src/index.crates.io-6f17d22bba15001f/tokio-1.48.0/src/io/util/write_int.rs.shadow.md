# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/write_int.rs
@source-hash: adcdc17f097c6b2f
@generated: 2026-02-09T18:02:54Z

## Purpose
Provides asynchronous integer/float writer futures for Tokio's I/O utilities. Generates specialized future types for writing binary data to AsyncWrite streams with proper endianness support.

## Key Macros

### writer! macro (L11-74)
Generates multi-byte integer/float writer futures that handle partial writes:
- Creates pinned future struct with internal buffer `[u8; N]` and write progress tracking
- `new()` constructor (L31-40) serializes value using `bytes::BufMut` methods
- `Future::poll()` (L49-71) implements stateful write loop with retry logic
- Handles `WriteZero` error when no bytes can be written
- Tracks bytes written to resume from interruption points

### writer8! macro (L76-122)  
Generates single-byte writer futures for u8/i8 types:
- Simpler structure without internal buffer or progress tracking
- Single poll attempt with immediate completion or failure
- `unreachable!()` branch (L117) for impossible multi-byte write from single byte

## Generated Future Types

### Multi-byte Writers (L127-151)
- **Big-endian**: `WriteU16`, `WriteU32`, `WriteU64`, `WriteU128`, `WriteI16`, `WriteI32`, `WriteI64`, `WriteI128`, `WriteF32`, `WriteF64`
- **Little-endian**: `WriteU16Le`, `WriteU32Le`, `WriteU64Le`, `WriteU128Le`, `WriteI16Le`, `WriteI32Le`, `WriteI64Le`, `WriteI128Le`, `WriteF32Le`, `WriteF64Le`

### Single-byte Writers (L124-125)
- `WriteU8`, `WriteI8` - direct byte writing without buffering

## Key Dependencies
- `bytes::BufMut` for binary serialization with endianness control
- `pin_project_lite` for safe pinned projection in async contexts  
- `PhantomPinned` to ensure futures are `!Unpin` for async trait compatibility

## Architecture Patterns
- **Resumable writes**: Multi-byte writers track progress to handle partial writes
- **Zero-copy serialization**: Pre-serialize to internal buffer, then stream bytes
- **Error propagation**: Converts I/O errors and detects write failures
- **Pin safety**: Uses pin projection for safe mutable access in async context

## Critical Invariants
- Buffer size must match type size for multi-byte writers
- `written` field must not exceed buffer length
- Single-byte writers assume exactly 0 or 1 byte written per poll
- All futures must be polled to completion for proper resource cleanup
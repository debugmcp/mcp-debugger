# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/src/buf/buf_impl.rs
@source-hash: a14aa7e5e7fac1d4
@generated: 2026-02-09T18:06:25Z

This file implements the core `Buf` trait for reading bytes from memory buffers in the bytes crate. The trait provides a cursor-based abstraction for efficient byte reading operations.

## Primary Purpose
Defines the `Buf` trait which enables infallible reading from byte buffers with automatic cursor advancement. Acts as an efficient iterator over collections of bytes, supporting both contiguous and non-contiguous memory layouts.

## Core Components

### Macros
- `buf_try_get_impl!` (L13-70): Complex macro implementing byte extraction with three variants - direct conversion, little-endian, and big-endian. Handles optimization for contiguous chunks vs. copying to temporary buffers.
- `buf_get_impl!` (L72-85): Wrapper macro that converts try_get operations to panicking versions using `panic_advance`.
- `deref_forward_buf!` (L2456-2879): Large macro generating forwarding implementations for reference types (`&mut T`, `Box<T>`).

### Utility Function  
- `sign_extend()` (L88-91): Performs sign extension for variable-width integer reading, using bit shifting to handle integers smaller than 8 bytes.

### Main Trait
- `Buf` trait (L117-2454): The central abstraction with core methods:
  - `remaining()` (L143): Returns bytes available for reading
  - `chunk()` (L176): Returns current contiguous slice (may be shorter than remaining)
  - `chunks_vectored()` (L207-218): Fills IoSlice array for vectored I/O operations
  - `advance()` (L250): Moves cursor forward by specified bytes
  - `has_remaining()` (L269-271): Convenience method checking if data available

### Reading Methods
Extensive family of typed reading methods in big-endian, little-endian, and native-endian variants:
- Single bytes: `get_u8()` (L315-325), `get_i8()` (L343-353)
- Multi-byte integers: `get_u16()` through `get_u128()` with endianness variants
- Variable-width integers: `get_uint()`/`get_int()` (L876-997) for 1-8 byte reads
- Floating point: `get_f32()`/`get_f64()` with endianness support
- All methods have `try_get_*` equivalents returning `Result<T, TryGetError>`

### Utility Methods
- `copy_to_slice()` (L294-297): Copies bytes to provided slice
- `try_copy_to_slice()` (L1161-1179): Fallible version with chunked copying
- `copy_to_bytes()` (L2358-2371): Creates owned `Bytes` from buffer data
- `take()` (L2394-2399): Creates limited-reading adapter
- `chain()` (L2416-2421): Chains multiple buffers
- `reader()` (L2448-2453): Creates `std::io::Read` adapter

### Implementations
- `&mut T` and `Box<T>` (L2881-2887): Forward all calls to inner type
- `&[u8]` (L2889-2924): Direct slice implementation with bounds checking
- `std::io::Cursor<T>` (L2927-2958): Cursor-based implementation using position tracking

## Architectural Decisions
- **Macro-heavy design**: Uses complex macros to generate repetitive endianness variants, reducing code duplication but increasing complexity
- **Zero-copy optimization**: `chunk()` method enables direct access to underlying memory when possible
- **Fallback buffering**: Automatically falls back to copying when direct access isn't available
- **Panic vs Result**: Provides both panicking and fallible versions of all operations
- **Vectored I/O support**: Built-in support for scatter-gather operations through `chunks_vectored`

## Critical Invariants
- `chunk().len() <= remaining()` must always hold
- `chunk()` returns empty slice iff `remaining() == 0`
- `advance(cnt)` must panic if `cnt > remaining()`
- Cursor position always advances by exact amount of data read
- All get operations are atomic - either succeed completely or fail without side effects

## Dependencies
- Conditional `std` feature for I/O integration (`IoSlice`, `std::io::Cursor`)
- Internal crate utilities: `panic_advance`, `panic_does_not_fit`, `TryGetError`
- Buffer combinators: `Take`, `Chain`, `Reader` types
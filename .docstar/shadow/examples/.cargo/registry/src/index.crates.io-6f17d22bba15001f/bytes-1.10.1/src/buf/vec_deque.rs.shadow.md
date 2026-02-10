# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/src/buf/vec_deque.rs
@source-hash: baac165527d1bdfc
@generated: 2026-02-09T18:06:19Z

## VecDeque<u8> Buf Implementation

This file implements the `Buf` trait for `VecDeque<u8>`, enabling VecDeque to be used as a readable byte buffer in the bytes crate ecosystem.

### Primary Purpose
Provides a `Buf` trait implementation that allows `VecDeque<u8>` to be consumed as a byte buffer, leveraging VecDeque's efficient double-ended queue properties for buffer operations.

### Key Implementation (L7-40)

**Core Methods:**
- `remaining()` (L8-10): Returns total bytes available via `self.len()`
- `chunk()` (L12-19): Returns next contiguous slice of bytes using `as_slices()` - prioritizes first slice if non-empty, otherwise returns second slice
- `advance()` (L37-39): Consumes `cnt` bytes from front using `drain(..cnt)`

**Vectored I/O Support:**
- `chunks_vectored()` (L22-35): Returns up to 2 `IoSlice` references for zero-copy vectored I/O operations (std feature only)
  - Handles empty buffer/destination early return
  - Maps VecDeque's two internal slices to IoSlice array
  - Returns count of populated slices (0-2)

### Dependencies
- `alloc::collections::VecDeque`: Core VecDeque type
- `std::io` (std feature): For IoSlice vectored I/O support
- `super::Buf`: The trait being implemented

### Architectural Notes
- Leverages VecDeque's ring buffer structure via `as_slices()` which returns at most two contiguous memory regions
- Prioritizes first slice in `chunk()` for consistent read ordering
- Uses `drain()` for `advance()` which efficiently removes elements from front
- Vectored I/O implementation maximizes zero-copy potential by exposing internal slices directly

### Key Invariants
- `chunk()` always returns a valid slice (empty if no data)
- `advance()` behavior undefined if `cnt > remaining()`
- Vectored I/O returns slices in read order (first slice, then second slice)
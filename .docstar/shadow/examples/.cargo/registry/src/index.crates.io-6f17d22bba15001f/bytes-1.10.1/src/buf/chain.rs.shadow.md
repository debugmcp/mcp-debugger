# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/src/buf/chain.rs
@source-hash: 27ff0a6fce049c51
@generated: 2026-02-09T18:06:21Z

## Purpose
Implements `Chain<T, U>` (L30-33), an adapter that sequences two buffers to provide a continuous view across both. Primary use case is chaining `Buf` or `BufMut` implementations for seamless sequential access.

## Key Components

### Core Structure
- `Chain<T, U>` (L30-33): Generic struct holding two buffers `a` and `b`
- `new()` (L37-39): Package-private constructor
- Accessor methods (L53-109): `first_ref/mut`, `last_ref/mut`, `into_inner` for buffer access

### Buf Implementation (L130-189)
- `remaining()` (L135-137): Returns saturating sum of both buffers' remaining bytes
- `chunk()` (L139-145): Returns current chunk from first buffer if available, else second
- `advance()` (L147-163): Advances through first buffer completely before moving to second
- `chunks_vectored()` (L166-170): Fills IoSlice array with chunks from both buffers (std feature)
- `copy_to_bytes()` (L172-188): Optimized copying that handles three cases:
  - All bytes from first buffer
  - All bytes from second buffer  
  - Split across both buffers (creates BytesMut, combines data)

### BufMut Implementation (L191-227)
- `remaining_mut()` (L196-200): Saturating sum of mutable capacity
- `chunk_mut()` (L202-208): Returns mutable chunk from first buffer if available, else second
- `advance_mut()` (L210-226): Unsafe method mirroring `advance()` logic for mutable buffers

### Iterator Support (L229-240)
- `IntoIterator` implementation yielding `u8` items via `IntoIter<Chain<T, U>>`

## Dependencies
- `crate::buf::{IntoIter, UninitSlice}` (L1)
- `crate::{Buf, BufMut}` (L2) 
- `std::io::IoSlice` (L5) - conditional on "std" feature

## Architectural Patterns
- **Sequential Access**: Always exhausts first buffer before accessing second
- **Saturating Arithmetic**: Prevents overflow in size calculations
- **Conditional Feature Gates**: `std` feature controls IoSlice functionality
- **Zero-Copy Optimization**: `copy_to_bytes()` avoids unnecessary copying when possible
- **Unsafe Boundaries**: `BufMut` implementation requires unsafe `advance_mut()`

## Critical Invariants
- Chain operations maintain buffer ordering (first → second)
- Advance operations never exceed available capacity
- Copy operations validate total length against available data (L179-182)
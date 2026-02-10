# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/src/buf/uninit_slice.rs
@source-hash: 52629b93ff7a08db
@generated: 2026-02-09T18:06:20Z

## Purpose
Safe wrapper around uninitialized byte slices for buffer operations in the bytes crate. Provides write-only access to uninitialized memory without introducing undefined behavior, serving as an intermediate type in `BufMut::chunk_mut()` operations.

## Key Components

**UninitSlice struct (L22)** - Transparent wrapper around `[MaybeUninit<u8>]` with strict safety invariants prohibiting reads and uninitialized byte writes.

### Construction Methods
- `new()` (L36-38) - Creates wrapper from initialized `&mut [u8]` using unsafe pointer casts
- `uninit()` (L55-57) - Creates wrapper from uninitialized `&mut [MaybeUninit<u8>]`
- `uninit_ref()` (L59-61) - Private helper for immutable reference creation
- `from_raw_parts_mut()` (L82-86) - Unsafe constructor from raw pointer and length

### Write Operations
- `write_byte()` (L107-111) - Bounds-checked single byte write using unsafe pointer operations
- `copy_from_slice()` (L134-142) - Bulk copy from initialized slice with length assertion

### Memory Access
- `as_mut_ptr()` (L161-163) - Returns raw mutable pointer with safety constraints
- `as_uninit_slice_mut()` (L187-189) - Unsafe conversion back to `&mut [MaybeUninit<u8>]`
- `len()` (L205-207) - Returns slice length

## Trait Implementations
- `Debug` (L210-214) - Opaque debug representation
- `From<&mut [u8]>` (L216-220) - Conversion from initialized slices  
- `From<&mut [MaybeUninit<u8>]>` (L222-226) - Conversion from uninitialized slices
- `Index/IndexMut` (L228-257) - Range-based indexing via macro for all range types

## Safety Architecture
Critical invariants enforced through API design:
1. No reading from UninitSlice (no read methods provided)
2. Only initialized bytes can be written (enforced by type system)
3. Transparent representation allows zero-cost abstraction over `[MaybeUninit<u8>]`

## Dependencies
- `core::mem::MaybeUninit` for uninitialized memory handling
- `core::ops` range types for comprehensive indexing support
- `core::fmt` for debug output

The type bridges safe Rust code with unsafe buffer management, ensuring memory safety while enabling efficient buffer operations.
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/src/buf/buf_mut.rs
@source-hash: 6cc3800b08dc36ea
@generated: 2026-02-09T18:06:21Z

**Primary Purpose**: Defines the `BufMut` trait for sequential write access to byte buffers, enabling efficient writing of various data types to memory buffers with cursor-based positioning.

**Core Trait**: 
- `BufMut` trait (L30-1351) - Unsafe trait providing sequential write access to bytes with cursor advancement
  - Core methods: `remaining_mut()` (L64), `advance_mut()` (L107), `chunk_mut()` (L179)
  - Write operations: `put()` (L202), `put_slice()` (L246), `put_bytes()` (L292)
  - Typed writers: `put_u8/i8()` (L330/354), integer variants for u16-u128/i16-i128 with endianness
  - Floating point: `put_f32/f64()` with endianness variants (L1139-1269)
  - Variable-width integers: `put_uint/int()` with endianness support (L962-1117)
  - Adapters: `limit()` (L1285), `writer()` (L1317), `chain_mut()` (L1345)

**Key Dependencies**:
- `UninitSlice` from `crate::buf` - handles uninitialized memory slices
- `TryGetError` from crate root - error type for capacity checks
- `panic_advance`, `panic_does_not_fit` - panic utilities for bounds checking
- Optional `Writer` adapter for std::io::Write compatibility (L1317)

**Implementations**:
- `&mut T` and `Box<T>` via forwarding macro `deref_forward_bufmut!` (L1353-1483)
- `&mut [u8]` (L1485-1539) - direct slice implementation with bounds checking
- `&mut [MaybeUninit<u8>]` (L1541-1597) - uninitialized memory slice support
- `Vec<u8>` (L1599-1667) - optimized implementation with auto-growth and specialized methods

**Safety Model**:
- Unsafe trait requiring implementors ensure memory safety
- `advance_mut()` requires caller to guarantee initialization of advanced bytes
- Extensive bounds checking with panic on capacity overflow
- All write operations are infallible within available capacity

**Architecture Notes**:
- Cursor-based design advancing position after writes
- Chunked writing for non-contiguous buffers
- Endianness-aware binary data serialization
- Zero-copy design where possible
- Trait object safe (verified by `_assert_trait_object` L1671)
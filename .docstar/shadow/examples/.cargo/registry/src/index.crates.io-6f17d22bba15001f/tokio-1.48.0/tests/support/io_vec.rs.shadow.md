# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/support/io_vec.rs
@source-hash: 9b3001e120138ead
@generated: 2026-02-09T18:06:49Z

**Primary Purpose**: Test utility wrapper for managing vectored I/O operations with `IoSlice` arrays, providing safe advancement through buffer collections.

**Core Structure**:
- `IoBufs<'a, 'b>` (L5): Wrapper around mutable slice of `IoSlice<'a>` with dual lifetime parameters
  - `'a`: lifetime of the underlying buffer data
  - `'b`: lifetime of the IoSlice array itself

**Key Methods**:
- `new()` (L8-10): Constructor accepting mutable slice of IoSlice references
- `is_empty()` (L12-14): Delegates to underlying slice emptiness check
- `advance()` (L16-37): **Critical method** - advances buffer position by `n` bytes
  - Removes fully consumed slices (L17-26)
  - Splits remaining slice using unsafe pointer manipulation (L28-32)
  - Panics if advancing beyond available data (L33-35)

**Unsafe Operations**:
- Line 31: Uses `slice::from_raw_parts()` to recast slice lifetime, maintaining original buffer lifetime `'a` while working with modified slice bounds

**Deref Implementation** (L40-45): Provides transparent access to underlying `[IoSlice<'a>]` slice

**Dependencies**:
- `std::io::IoSlice`: Core I/O vectored buffer type
- `std::ops::Deref`: Trait for transparent dereferencing
- `std::slice`: For unsafe slice manipulation

**Architectural Pattern**: 
Follows RAII pattern with lifetime-safe buffer management. The `advance()` method implements zero-copy buffer advancement by manipulating slice boundaries rather than copying data.

**Critical Invariants**:
- Lifetime `'a` must outlive `'b` to ensure buffer data remains valid
- `advance()` maintains buffer validity through unsafe pointer recasting
- Panic behavior ensures no silent buffer overruns
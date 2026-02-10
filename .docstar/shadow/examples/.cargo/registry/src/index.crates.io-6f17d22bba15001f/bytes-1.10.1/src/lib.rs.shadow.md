# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/src/lib.rs
@source-hash: 6a59680076e75d4b
@generated: 2026-02-09T18:11:28Z

**Purpose:** Root module for the bytes crate - provides efficient byte buffer abstractions optimized for zero-copy networking operations. This is a `no_std` compatible crate with optional `std` feature support.

**Key Exports:**
- `Buf`, `BufMut` traits (L80): Core buffer reading/writing abstractions for working with potentially non-contiguous memory
- `Bytes` struct (L86): Immutable, reference-counted byte buffer for zero-copy operations  
- `BytesMut` struct (L87): Mutable byte buffer that can be converted to `Bytes`

**Architecture:**
- **Module Structure:** Separates concerns across `buf/`, `bytes`, `bytes_mut`, `fmt`, `loom` modules
- **Feature Gates:** Conditional compilation for `std` (L76-77, L96-98, L115-132, L159-167) and `serde` (L90-91) features
- **Memory Safety:** Uses reference counting for shared ownership of byte data, enabling zero-copy semantics

**Core Types:**
- `TryGetError` struct (L139-146): Error type indicating insufficient buffer bytes, with `requested` and `available` fields
- Implements `Display` (L148-157), `std::error::Error` (L160), and `From<TryGetError>` for `std::io::Error` (L163-167)

**Utility Functions:**
- `abort()` (L93-112): Platform-specific abort implementation - uses `std::process::abort()` with std feature, otherwise panics via Drop trait
- `saturating_sub_usize_u64()` (L115-122): Safe subtraction handling overflow via `TryFrom` conversion
- `min_u64_usize()` (L125-132): Safe minimum calculation between u64 and usize
- `panic_advance()` (L170-176): Formatted panic for buffer advance bounds errors
- `panic_does_not_fit()` (L178-184): Formatted panic for size overflow errors  
- `offset_from()` (L196-198): Pointer offset calculation for Rust <1.47 compatibility

**Design Patterns:**
- **Zero-copy optimization:** Multiple `Bytes` instances can reference same underlying memory
- **Cursor-based access:** `Buf`/`BufMut` maintain position tracking unlike `Read`/`Write`
- **Infallible operations:** Buffer operations don't perform syscalls, unlike std I/O traits
- **Backward compatibility:** Manual pointer arithmetic for older Rust versions (L186-198)
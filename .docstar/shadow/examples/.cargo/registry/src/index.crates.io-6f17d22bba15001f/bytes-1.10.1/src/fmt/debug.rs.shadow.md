# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/src/fmt/debug.rs
@source-hash: 4d217b8f43e48992
@generated: 2026-02-09T18:06:17Z

## Purpose
Provides ASCII-friendly debug formatting for bytes types in the `bytes` crate. Instead of displaying byte arrays as comma-separated numeric lists, this module renders them as byte string literals with proper escape sequences when they contain ASCII text.

## Key Implementation

**BytesRef Debug Implementation (L12-37)**
- Custom `Debug` trait implementation for `BytesRef<'_>` wrapper type
- Formats bytes as `b"..."` string literals with escape sequences
- Handles common escape sequences: `\n`, `\r`, `\t`, `\\`, `\"`, `\0`
- ASCII printable characters (0x20-0x7f) display as-is (L28-29)
- Non-printable bytes render as hex escapes `\x{:02x}` (L31)
- Follows Rust byte literal escape conventions per reference documentation (L16)

**Macro-Generated Implementations (L39-40)**
- Uses `fmt_impl!` macro to generate `Debug` implementations for `Bytes` and `BytesMut`
- Delegates to the `BytesRef` implementation via wrapper pattern

## Dependencies
- `core::fmt` for formatting traits and types (L1)
- `super::BytesRef` wrapper type from parent module (L3)
- `crate::{Bytes, BytesMut}` main bytes types (L4)

## Design Pattern
Implements the newtype pattern with `BytesRef` as a formatting wrapper, allowing custom debug behavior without modifying the core types directly. The macro system provides consistent formatting across all bytes types in the crate.
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/switch.rs
@source-hash: bfdcaf0268d79652
@generated: 2026-02-09T18:11:27Z

## Purpose
Platform-specific C type definitions for Nintendo Switch, providing Rust type aliases that match the C ABI on the Switch platform.

## Key Type Definitions
- **Integer types (L3-4)**: `intmax_t` as `i64`, `uintmax_t` as `u64` - maximum width integer types
- **Memory types (L6-10)**: Standard memory/pointer size types mapped to platform-appropriate Rust primitives:
  - `size_t` → `usize` (L6)
  - `ptrdiff_t` → `isize` (L7) 
  - `intptr_t` → `isize` (L8)
  - `uintptr_t` → `usize` (L9)
  - `ssize_t` → `isize` (L10)
- **Platform-specific types (L12-13)**: 
  - `off_t` as `i64` - file offset type (L12)
  - `wchar_t` as `u32` - wide character type (L13)
- **Integer constants (L15-16)**: Standard 32-bit signed integer bounds

## Architecture Notes
- Switch uses 64-bit architecture evident from pointer types mapping to `isize`/`usize`
- Wide characters are 32-bit (UTF-32), typical for Nintendo platforms
- File offsets support 64-bit addressing
- Part of libc crate's platform abstraction layer for C interoperability

## Dependencies
Implicitly depends on `c_int` type (referenced in constants but not defined in this file).
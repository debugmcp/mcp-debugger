# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/debug/mod.rs
@source-hash: 1259df940bbcaa96
@generated: 2026-02-09T18:06:31Z

## Primary Purpose
Test utilities for lightweight Debug formatting of syn AST types. Provides a `Lite` wrapper that renders Debug output without excessive noise for testing syn's parser output.

## Key Components

**Lite struct (L16-20)**: Zero-cost transparent wrapper using `RefCast` to provide alternative Debug implementations. Uses `#[repr(transparent)]` to ensure memory layout compatibility.

**Lite constructor function (L23-25)**: Non-snake_case function that creates `&Lite<T>` from `&T` using `RefCast::ref_cast()`.

**Deref implementation (L27-33)**: Allows `Lite<T>` to transparently access the wrapped value.

## Debug Implementations

**Primitive types (L35-51)**: Direct formatting for `bool`, `u32`, `usize` without debug formatting noise.

**String type (L53-57)**: Uses quoted debug format `{:?}` to preserve string literals properly.

**proc_macro2 types**:
- **Ident (L59-63)**: Converts to string then applies debug formatting
- **Literal (L65-69)**: Direct display formatting without quotes
- **TokenStream (L71-83)**: Smart formatting - inline for ≤80 chars, tuple format for longer streams

**Container types**:
- **Reference wrapper (L85-92)**: Delegates to underlying type's Lite Debug impl
- **Box wrapper (L94-101)**: Unwraps and delegates to inner type
- **Vec wrapper (L103-113)**: Formats as debug list with Lite-wrapped entries
- **Punctuated wrapper (L115-129)**: Handles syn's punctuated sequences by interleaving nodes and punctuation

## Helper Types

**Present struct (L131-137)**: Always displays as "Some" for testing presence indicators.

**Option struct (L139-147)**: Custom Option-like type that displays "Some"/"None" based on boolean flag.

## Dependencies
- `proc_macro2`: Token stream types (`Ident`, `Literal`, `TokenStream`)
- `ref_cast`: Zero-cost casting via `RefCast` derive
- `syn::punctuated`: Punctuated sequence support

## Architectural Pattern
Uses the newtype pattern with `RefCast` to provide alternative Debug implementations without modifying original types. The transparent representation ensures zero runtime cost while enabling customized test output formatting.
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/export.rs
@source-hash: b260cc49da1da348
@generated: 2026-02-09T18:12:14Z

This file serves as an internal re-export module for the `syn` crate, providing hidden public access to standard library types and crate-internal functionality. Its primary purpose is to consolidate imports needed by procedural macros and generated code.

## Key Re-exports and Types

**Standard Library Re-exports (L2-20):**
- Core traits: `Clone`, `Eq`, `PartialEq`, `Default`, `Debug`, `Hash`, `Copy` 
- Essential types: `Option` variants (`None`, `Some`), `Result` variants (`Err`, `Ok`)
- Macros: `concat!`, `stringify!`

**Type Aliases (L23-30):**
- `Formatter<'a>` and `FmtResult` (L23-25): Formatting utilities
- `bool` and `str` (L28-30): Primitive type aliases

**Procedural Macro Types (L37-66):**
- `Span` and `TokenStream2` (L37-39): proc_macro2 token handling
- `TokenStream` (L66): Standard proc_macro token stream (feature-gated)

**Feature-Gated Exports:**
- Printing support (L34, L70): `quote` crate and `ToTokens` trait
- Parsing utilities (L43, L54): Group parsing functions, punctuation handling
- Combined parsing/printing (L50): `parse_quote` macro
- Custom token support (L62): `CustomToken` for parsing

**Internal Utilities:**
- `IntoSpans` trait (L46): Span conversion functionality  
- `private` struct (L73): Zero-sized marker for internal use

## Architectural Pattern

This module follows a common pattern in Rust procedural macro crates where internal functionality is re-exported through a single module with `#[doc(hidden)]` attributes. This allows generated code and macros to access necessary types without exposing them in the public API documentation. The feature flags (`parsing`, `printing`, `proc-macro`) enable conditional compilation of different syn capabilities.
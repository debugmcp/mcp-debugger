# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/quote-1.0.42/src/ident_fragment.rs
@source-hash: 0b3e6c2129e55910
@generated: 2026-02-09T18:11:47Z

## Purpose
Defines the `IdentFragment` trait for formatting identifier fragments in the `quote` crate's `format_ident!` macro. Provides safe, controlled formatting of various types as Rust identifiers with automatic `r#` prefix stripping.

## Core Components

### IdentFragment Trait (L13-23)
Primary trait for types that can be formatted as identifier fragments:
- `fmt()` method (L15): Core formatting function, similar to `Display::fmt`
- `span()` method (L20-22): Optional span information for proc-macro diagnostics, defaults to `None`

### Key Implementations

**Ident Implementation (L45-58)**
- Strips `r#` raw identifier prefix when formatting (L52-53)
- Provides span information from the original `Ident` (L46-48)
- Critical for handling raw identifiers in macro contexts

**Reference Implementations (L25-43)**
- `&T` and `&mut T` implementations that delegate to the underlying type
- Preserves span information through reference layers
- Enables flexible usage patterns in macros

**Cow Implementation (L60-71)**
- Supports both owned and borrowed data via `Cow<'_, T>`
- Delegates to underlying `T` implementation
- Enables efficient string handling in macro contexts

### Type Coverage Macro (L75-87)
`ident_fragment_display!` macro provides `IdentFragment` implementations for safe primitive types:
- Basic types: `bool`, `str`, `String`, `char` (L87)
- Integer types: `u8` through `u128`, `usize` (L88)
- Intentionally limited set to avoid non-identifier characters

## Dependencies
- `proc_macro2::Ident` and `Span` for procedural macro integration
- `alloc::borrow::Cow` for efficient string handling
- `core::fmt` for formatting infrastructure

## Design Constraints
- Limited to types unlikely to contain non-identifier characters (L73-74)
- Automatic `r#` prefix handling for raw identifiers
- Span preservation for diagnostic quality in proc-macros
- Zero-cost abstractions through trait delegation
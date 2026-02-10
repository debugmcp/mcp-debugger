# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/ext.rs
@source-hash: 57577c7e6b7b65cd
@generated: 2026-02-09T18:12:17Z

## Purpose
Extension traits module providing additional parsing and utility methods for foreign types, primarily extending `proc_macro2::Ident` with keyword-aware parsing capabilities and utility functions for token manipulation.

## Key Traits and Implementations

### IdentExt Trait (L22-95)
Public sealed trait extending `proc_macro2::Ident` with enhanced parsing capabilities:

- **parse_any()** (L53-55): Parses any identifier including Rust keywords, useful for macro input processing
- **peek_any** (L65): Constant for peeking any identifier (including keywords) during parsing
- **unraw()** (L94): Strips raw identifier marker `r#` prefix from identifiers

**Implementation for Ident** (L97-114):
- **parse_any()** (L99-104): Uses cursor-based parsing to accept any identifier token
- **unraw()** (L106-113): String manipulation to remove `r#` prefix while preserving span information

### Internal Utility Traits

**TokenStreamExt** (L135-143): Internal trait for `TokenStream` manipulation
- **append()** (L140-142): Efficiently appends single `TokenTree` to stream

**PunctExt** (L145-155): Internal trait for `Punct` creation
- **new_spanned()** (L150-154): Creates punctuation token with custom span

## Parsing Infrastructure (L117-133)
- **PeekFn implementation** (L117-119): Integrates with syn's peek system using `IdentAny` token type
- **IdentAny CustomToken** (L122-130): Defines how to peek for any identifier in token stream
- **Sealed trait integration** (L133): Prevents external implementations

## Private Module (L157-179)
Contains implementation details:
- **Sealed trait** (L160-162): Prevents external trait implementations
- **PeekFn/IdentAny types** (L164-168): Support types for parsing infrastructure
- **Clone/Copy implementations** (L171-178): Standard trait implementations for `PeekFn`

## Dependencies
- `proc_macro2`: Core token types (Ident, Punct, TokenStream, etc.)
- `crate::parse`: ParseStream, Peek traits (parsing feature)
- `crate::buffer`: Cursor for low-level parsing (parsing feature)
- `crate::token`: CustomToken trait (parsing feature)

## Architectural Patterns
- **Sealed traits**: Prevents external implementations while providing public interface
- **Feature gating**: Parsing functionality conditionally compiled with "parsing" feature
- **Extension traits**: Adds methods to foreign types without modification
- **Type-safe parsing**: Uses strongly-typed tokens for parsing operations
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/quote-1.0.42/src/ext.rs
@source-hash: 33e41c8a11743de7
@generated: 2026-02-09T18:11:46Z

## Purpose
Extension trait for `proc_macro2::TokenStream` providing convenient methods for building token streams in procedural macros. Part of the `quote` crate's token construction API.

## Key Components

### TokenStreamExt Trait (L8-57)
Sealed extension trait providing four core methods for token stream construction:
- `append<U>()` (L12-14): Appends a single token that can convert to `TokenTree`
- `append_all<I>()` (L33-36): Appends all items from an iterator implementing `ToTokens`
- `append_separated<I, U>()` (L42-46): Appends items with separator tokens between them
- `append_terminated<I, U>()` (L52-56): Appends items with terminator tokens after each

### Implementation for TokenStream (L59-128)
Concrete implementation with nested helper functions for performance:
- `append()` (L60-65): Uses `extend(iter::once())` for single token insertion
- `append_all()` (L67-83): Delegates to inner `do_append_all()` (L74-82) for iterator processing
- `append_separated()` (L85-106): Uses `do_append_separated()` (L93-105) with enumeration for conditional separator insertion
- `append_terminated()` (L108-127): Uses `do_append_terminated()` (L116-126) for unconditional terminator insertion

### Sealing Module (L130-136)
Private module implementing the sealed trait pattern:
- `Sealed` trait (L133) prevents external implementations
- Implementation for `TokenStream` (L135)

## Dependencies
- `super::ToTokens`: Core trait for token conversion
- `core::iter`: Standard iterator utilities
- `proc_macro2::{TokenStream, TokenTree}`: Procedural macro token types

## Architecture Patterns
- **Sealed Trait**: Prevents external trait implementations while allowing public usage
- **Inner Functions**: Performance optimization by avoiding generic monomorphization overhead
- **Builder Pattern**: Methods modify `&mut self` for fluent chaining
- **Generic Constraints**: Flexible type parameters bounded by conversion traits

## Key Invariants
- All append operations modify the token stream in-place
- Separator insertion only occurs between items (not before first or after last)
- Terminator insertion occurs after every item including the last
- All operations preserve token stream validity
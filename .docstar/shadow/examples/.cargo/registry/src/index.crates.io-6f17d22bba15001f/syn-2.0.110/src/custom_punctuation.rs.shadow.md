# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/custom_punctuation.rs
@source-hash: 26b28164f0b2e5e8
@generated: 2026-02-09T18:12:17Z

## Primary Purpose
Provides macro infrastructure for defining custom multi-character punctuation tokens in syn's parsing framework. Enables users to create custom operators like `<=>` that integrate seamlessly with syn's parsing, printing, and token manipulation APIs.

## Core Components

### Main Entry Point
- `custom_punctuation!` macro (L79-110): Primary user-facing macro that generates a complete custom punctuation type with parsing, printing, and trait implementations

### Generated Type Structure
Each custom punctuation generates:
- Public struct with `spans` field containing span information
- Constructor function accepting `IntoSpans` trait objects (L88-95)
- Default implementation using call-site span (L98-101)

### Feature-Conditional Implementation Macros
- `impl_parse_for_custom_punctuation!` (L116-144): Generates `Parse` and `CustomToken` trait implementations when "parsing" feature enabled
- `impl_to_tokens_for_custom_punctuation!` (L150-166): Generates `ToTokens` implementation when "printing" feature enabled  
- `impl_clone_for_custom_punctuation!` (L172-191): Generates `Copy` and `Clone` implementations when "clone-impls" feature enabled
- `impl_extra_traits_for_custom_punctuation!` (L197-225): Generates `Debug`, `Eq`, `PartialEq`, `Hash` when "extra-traits" feature enabled

### Utility Macros
- `custom_punctuation_repr!` (L230-234): Determines span array size for punctuation tokens
- `custom_punctuation_len!` (L240-289): Maps punctuation tokens to their character length, supports both lenient and strict modes
- `stringify_punct!` (L301-305): Converts token trees to string representation
- `custom_punctuation_unexpected!` (L294-296): Error handling for unrecognized punctuation in strict mode

## Key Design Patterns

### Feature-Gated Implementations
Uses conditional compilation to include only necessary trait implementations based on enabled features, reducing binary size when features aren't needed.

### Span Preservation  
Maintains precise source location information through span arrays, enabling accurate error reporting and code generation.

### Macro Composition
Complex functionality built through layered macro calls, with the main macro delegating to specialized implementation macros.

## Dependencies
- Relies on `syn::__private` module for core parsing/printing utilities
- Uses `proc_macro2::Span` for source location tracking
- Integrates with `quote::ToTokens` for code generation

## Usage Pattern
Users call `syn::custom_punctuation!(TypeName, tokens)` to generate a complete punctuation type that works with `ParseStream::parse()`, `ParseBuffer::peek()`, and `quote!` macro seamlessly.
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/spanned.rs
@source-hash: 4b9bd65f60ab8192
@generated: 2026-02-09T18:11:55Z

## Primary Purpose
This module provides the `Spanned` trait for extracting complete span information from syntax tree nodes in the syn crate. It enables procedural macros to generate precise error messages by associating generated code with the original source locations.

## Key Components

**Spanned Trait (L96-102)**
- Core trait providing `span()` method to extract `proc_macro2::Span` from syntax tree nodes
- Returns complete span covering entire node contents, or `Span::call_site()` for empty nodes
- Sealed trait pattern prevents external implementation

**Blanket Implementation (L104-108)**
- Implements `Spanned` for any type that implements `quote::spanned::Spanned` (aliased as `ToTokens`)
- Delegates to the `__span()` method from the quote crate
- Covers all syn AST types automatically

**Sealing Module (L110-118)**
- Private module implementing sealed trait pattern via `private::Sealed`
- Prevents external crates from implementing `Spanned` directly
- Special case for `QSelf` type when "full" or "derive" features are enabled

## Dependencies
- `proc_macro2::Span` - Core span type for token positioning
- `quote::spanned::Spanned` - Underlying span extraction from quote crate

## Architectural Notes
- Uses sealed trait pattern for API stability
- Leverages existing quote crate infrastructure rather than reimplementing span logic
- Feature-gated conditional implementation for `QSelf`

## Key Use Case
Enables precise error reporting in procedural macros by preserving original source location information when generating code, particularly useful for trait bound assertions and similar compile-time checks.
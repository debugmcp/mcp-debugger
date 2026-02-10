# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/parse_quote.rs
@source-hash: 80eec7ce54c38f3b
@generated: 2026-02-09T18:11:58Z

## Purpose
Parse quote macros for the `syn` crate that enable quasi-quotation with type inference. Provides `parse_quote!` and `parse_quote_spanned!` macros that accept quote-style syntax and parse it into any AST node implementing `Parse`.

## Key Macros
- **`parse_quote!` (L80-84)**: Main quasi-quotation macro that uses type inference to determine return type. Combines `quote!` with parsing functionality
- **`parse_quote_spanned!` (L112-116)**: Span-aware version combining `parse_quote!` with `quote_spanned!` for preserving source location information

## Core Implementation
- **`parse<T: ParseQuote>` (L128-134)**: Hidden function that performs actual parsing with panic on error using `#[track_caller]`
- **`ParseQuote` trait (L137-139)**: Internal trait defining parsing interface with single `parse` method
- **Blanket impl for `Parse` types (L141-145)**: Allows any type implementing `Parse` to work with parse quote macros

## Special Case Implementations
The file provides `ParseQuote` implementations for types that don't naturally implement `Parse`:

- **`Attribute` (L157-165)**: Handles both outer `#[...]` and inner `#![...]` attributes with peek-based detection
- **`Vec<Attribute>` (L168-176)**: Parses multiple attributes of mixed kinds until input exhausted
- **`Field` (L179-206)**: Parses named/unnamed struct fields with visibility, optional identifier, and type
- **`Pat` (L209-213)**: Uses `Pat::parse_multi_with_leading_vert` for pattern parsing
- **`Box<Pat>` (L216-220)**: Wraps `Pat` parsing in `Box::new`
- **`Punctuated<T, P>` (L222-226)**: Parses terminated punctuated sequences
- **`Vec<Stmt>` (L229-233)**: Uses `Block::parse_within` for statement parsing
- **`Vec<Arm>` (L236-240)**: Uses `Arm::parse_multiple` for match arm parsing

## Dependencies
- `proc_macro2::TokenStream` for token stream handling
- `crate::parse::{Parse, ParseStream, Parser}` for parsing infrastructure
- Feature-gated imports for `full` and `derive` features

## Architectural Notes
- Macros expand to calls to internal `__private::parse_quote` function
- Uses panic-on-error strategy rather than `Result` returns
- Heavy use of feature gates to conditionally compile implementations
- Leverages existing parsing methods from other modules rather than reimplementing logic
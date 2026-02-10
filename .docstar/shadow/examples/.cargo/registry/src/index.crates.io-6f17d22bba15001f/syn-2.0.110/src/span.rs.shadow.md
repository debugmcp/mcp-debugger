# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/span.rs
@source-hash: 0a48e375e5c9768f
@generated: 2026-02-09T18:11:56Z

This module provides span conversion utilities for the `syn` crate, enabling flexible transformation between different span representations used in procedural macro contexts.

## Core Components

**`IntoSpans<S>` trait (L5-7)**: Hidden trait that defines a generic conversion interface for transforming span-like types into target span types `S`. The single method `into_spans(self) -> S` handles the conversion logic.

## Span Conversions

**Identity conversions**: Several implementations provide pass-through conversions where input and output types match:
- `Span -> Span` (L9-13): Direct identity conversion
- `[Span; 1] -> [Span; 1]` (L33-37): Array identity conversion  
- `[Span; 2] -> [Span; 2]` (L39-43): Array identity conversion
- `[Span; 3] -> [Span; 3]` (L45-49): Array identity conversion
- `DelimSpan -> DelimSpan` (L59-63): DelimSpan identity conversion

**Span duplication**: Implementations that convert single spans into arrays by duplicating the span:
- `Span -> [Span; 1]` (L15-19): Creates single-element array
- `Span -> [Span; 2]` (L21-25): Creates two-element array with duplicated span
- `Span -> [Span; 3]` (L27-31): Creates three-element array with duplicated span

**DelimSpan creation** (L51-57): Converts a regular `Span` to `DelimSpan` by creating a temporary `Group` with `Delimiter::None`, setting its span, and extracting the delimiter span.

## Dependencies

- `proc_macro2`: Primary dependency for `Span`, `DelimSpan`, `Group`, `Delimiter`, and `TokenStream` types
- Used internally by syn's parsing infrastructure for span management

## Design Pattern

Implements a conversion trait pattern that allows uniform handling of different span representations. The trait is marked `#[doc(hidden)]` indicating it's internal API not meant for direct public consumption. This enables syn's parsers to work with various span configurations through a unified interface.
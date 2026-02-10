# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/quote-1.0.42/src/spanned.rs
@source-hash: 713678bf5cb3b4bf
@generated: 2026-02-09T18:11:47Z

## Purpose
Provides span information for tokens in procedural macros. This module implements a sealed trait pattern to extract source location spans from various token types, primarily for integration with the `syn` crate's spanning functionality.

## Core Components

### Spanned Trait (L6-8)
- **Primary interface**: Sealed trait for extracting span information
- **Key method**: `__span(&self) -> Span` - returns the source location span
- **Access pattern**: Not public API - intended for use via `syn::spanned::Spanned`
- **Sealing**: Uses private::Sealed trait to prevent external implementations

### Trait Implementations

**Span Implementation (L10-14)**
- Direct passthrough - returns the span itself unchanged
- Most efficient implementation for already-available spans

**DelimSpan Implementation (L16-20)**  
- Uses `DelimSpan::join()` to create a single span from delimiter boundaries
- Handles bracket/parenthesis/brace span joining

**Generic ToTokens Implementation (L22-26)**
- Blanket implementation for any type implementing `ToTokens`
- Delegates to `join_spans()` utility function
- Enables span extraction from complex token structures

### Utility Functions

**join_spans() (L28-38)**
- **Purpose**: Combines multiple token spans into a single encompassing span
- **Algorithm**: 
  - Maps token stream to individual spans
  - Uses first span as base, folds to find last span
  - Attempts to join first and last spans
  - Falls back to first span if joining fails
- **Edge case**: Returns `Span::call_site()` for empty token streams

### Sealing Module (L40-49)
- **Pattern**: Sealed trait implementation preventing external trait implementations
- **Coverage**: Mirrors all public Spanned implementations
- **Purpose**: API control and forward compatibility

## Dependencies
- `proc_macro2`: Core span and token stream types
- `crate::ToTokens`: Token conversion trait dependency

## Architectural Notes
- **Design pattern**: Sealed trait prevents external implementations
- **Integration point**: Designed for syn crate consumption
- **Span handling**: Robust fallback strategy for span joining failures
- **Performance**: Minimal overhead with direct span passthrough where possible
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/meta.rs
@source-hash: 969d8ccbdbc6ea2e
@generated: 2026-02-09T18:11:57Z

## Purpose
Facility for interpreting structured content inside Rust attributes using a recursive parsing approach. Provides utilities to parse nested attribute syntax like `#[attr(key = "value", nested(inner))]` in procedural macros.

## Key Components

**`parser` function (L132-140)**: Creates a parser closure compatible with `parse_macro_input!` for `proc_macro_attribute` macros. Takes user logic as closure parameter and handles empty input gracefully.

**`ParseNestedMeta` struct (L164-167)**: Core context for parsing individual attribute properties. Contains:
- `path: Path` - The identifier path being parsed
- `input: ParseStream` - Remaining tokens to parse

**Key `ParseNestedMeta` methods:**
- `value()` (L202-205): Parses `=` token for `key = "value"` syntax, returns remaining stream
- `parse_nested_meta()` (L271-278): Recursively parses parenthesized content `list(...)` using same structured convention
- `error()` (L378-382): Creates span-aware errors covering parsed path and consumed tokens

**`parse_nested_meta` function (L385-400)**: Internal parser loop that:
- Calls `parse_meta_path` to extract path segments
- Invokes user logic with `ParseNestedMeta` context
- Handles comma separation and trailing commas
- Continues until input exhausted

**`parse_meta_path` function (L403-427)**: Specialized path parser accepting keywords, unlike standard `Path::parse_mod_style`. Builds `Path` with `Punctuated<PathSegment>` segments, handling `::` separators.

## Architecture Patterns
- Recursive descent parsing with user-provided callbacks
- Context-passing design allowing nested parsing levels  
- Span-preserving error reporting with meaningful ranges
- Graceful handling of trailing commas and empty inputs

## Usage Context
Designed for parsing structured attribute arguments in derive macros and attribute macros. Provides better error messages than manual parsing by preserving span information and following Rust's attribute conventions.

## Dependencies
- `crate::parse::{ParseStream, Parser}` for parsing infrastructure
- `crate::path::{Path, PathSegment}` for path representation
- `crate::punctuated::Punctuated` for comma-separated sequences
- `proc_macro2::Ident` for identifier handling
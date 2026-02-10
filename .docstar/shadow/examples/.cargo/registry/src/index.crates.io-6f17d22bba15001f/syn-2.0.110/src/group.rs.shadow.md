# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/group.rs
@source-hash: ddbff97e41315bdf
@generated: 2026-02-09T18:11:54Z

## Primary Purpose

Provides parsing utilities for delimited syntax groups (parentheses, braces, brackets) in Rust procedural macros. Part of the syn crate's parsing infrastructure, offering both programmatic APIs and declarative macros for extracting content from delimited token groups.

## Key Data Structures

**Parens<'a> (L9-14)**: Hidden API struct containing a `token::Paren` and `ParseBuffer` for parentheses content
**Braces<'a> (L18-23)**: Hidden API struct containing a `token::Brace` and `ParseBuffer` for brace content  
**Brackets<'a> (L27-32)**: Hidden API struct containing a `token::Bracket` and `ParseBuffer` for bracket content
**Group<'a> (L37-42)**: Feature-gated struct for invisible delimiter groups, contains `token::Group` and `ParseBuffer`

## Core Functions

**parse_parens (L46-51)**: Hidden API function that parses parenthetical groups, delegates to `parse_delimited` with `Delimiter::Parenthesis`
**parse_braces (L55-60)**: Hidden API function that parses brace groups, delegates to `parse_delimited` with `Delimiter::Brace`
**parse_brackets (L64-69)**: Hidden API function that parses bracket groups, delegates to `parse_delimited` with `Delimiter::Bracket`
**parse_group (L72-77)**: Feature-gated internal function for parsing invisible groups using `Delimiter::None`
**parse_delimited (L79-100)**: Core implementation function that handles the actual parsing logic using cursor stepping

## Public Macros

**parenthesized! (L146-158)**: Declarative macro for parsing parenthetical content, extracts content into a variable and returns the token
**braced! (L224-236)**: Declarative macro for parsing brace content, similar pattern to parenthesized!
**bracketed! (L279-291)**: Declarative macro for parsing bracket content, completes the trio of delimiter macros

## Dependencies

- `crate::error::Result` for error handling
- `crate::parse::ParseBuffer` for parsing state management
- `crate::token` for token types
- `proc_macro2::{DelimSpan, Delimiter}` for delimiter handling

## Architecture Patterns

- **Hidden API Design**: Most structs and functions are marked `#[doc(hidden)]` as internal implementation details
- **Feature Gating**: Group functionality requires "full" or "derive" features
- **Macro Delegation**: Public macros delegate to hidden parsing functions via `$crate::__private::`
- **Cursor-based Parsing**: Uses cursor stepping pattern with error recovery
- **Span Preservation**: Maintains delimiter span information for accurate source location tracking

## Critical Constraints

- All data structures use lifetime parameter `'a` tied to input ParseBuffer lifetime
- Error messages in `parse_delimited` are delimiter-specific for better diagnostics
- Macros use early return pattern for error propagation in parsing contexts
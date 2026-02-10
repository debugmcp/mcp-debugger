# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/src/fallback.rs
@source-hash: 962e1897fefb1381
@generated: 2026-02-09T18:11:53Z

**Fallback Implementation for Proc Macro Token Stream API**

This module provides a pure Rust fallback implementation for proc-macro2's token stream API, used when the compiler's native proc-macro implementation is unavailable or explicitly disabled.

## Core Architecture

The module implements a complete token stream parser and manipulation system with conditional span location tracking based on feature flags. It uses reference-counted vectors (`RcVec`) for efficient memory management of token trees.

## Key Types & Functions

### Control Functions
- `force()` (L33-36): Forces use of fallback implementation over compiler's native version
- `unforce()` (L40-43): Resumes using compiler's implementation when available

### Token Stream Types
- `TokenStream` (L46-48): Core token stream wrapper around `RcVec<TokenTree>`
  - `from_str_checked()` (L74-85): Parses string to token stream with error handling
  - `is_empty()` (L92-94): Checks if stream contains no tokens
  - `take_inner()` (L96-99): Extracts internal vector using unsafe memory manipulation
  - Custom `Drop` implementation (L128-158): Non-recursive destructor to prevent stack overflow
- `TokenStreamBuilder` (L160-186): Builder pattern for constructing token streams
- `LexError` (L50-65): Lexical analysis error with span information

### Span Management (Conditional)
- `Span` (L496-502): Position information in source code
  - `call_site()` (L505-513): Creates default span
  - `join()` (L594-618): Combines two spans if they're from same file
  - `source_text()` (L625-638): Extracts source text for span
  - `byte_range()` (L536-548): Gets byte range within source

### Source Map System (L317-494)
When `span_locations` feature is enabled and not fuzzing:
- `SOURCE_MAP` (L317-328): Thread-local source file registry
- `SourceMap` (L427-494): Manages multiple source files with span tracking
- `FileInfo` (L337-407): Per-file metadata including line/column mapping

### Token Types
- `Group` (L695-771): Delimited token groups (parens, braces, brackets)
- `Ident` (L773-917): Identifiers with raw identifier support
  - Validation functions: `validate_ident()` (L827-853), `validate_ident_raw()` (L856-865)
- `Literal` (L919-1213): Literal values with comprehensive constructor methods
  - Numeric constructors (L983-1014): Suffixed/unsuffixed for all integer/float types
  - String constructors: `string()` (L1032-1038), `byte_string()` (L1072-1096), `c_string()` (L1098-1124)

### Utility Functions
- `push_token_from_proc_macro()` (L102-125): Handles negative literal splitting for compatibility
- `get_cursor()` (L189-208): Creates parsing cursor with span tracking
- `escape_utf8()` (L1191-1213): Escapes strings for literal representation
- `debug_span_field_if_nontrivial()` (L682-693): Conditional debug span formatting

## Feature Flag Architecture

The code extensively uses conditional compilation:
- `span_locations`: Enables position tracking in source code
- `fuzzing`: Disables complex span tracking for fuzzing builds
- `wrap_proc_macro`: Enables integration with compiler's proc-macro
- `proc-macro`: Provides compatibility with std proc-macro types
- `procmacro2_semver_exempt`: Exposes unstable APIs

## Memory Management

Uses `RcVec` for reference-counted shared ownership of token vectors, with custom `Drop` implementation using iterative (not recursive) cleanup to prevent stack overflow on deeply nested token trees.

## Integration Points

- `FromStr2` trait (L1216-1248): Bridge for converting between compiler and fallback implementations
- Extensive `Display`/`Debug` implementations for all token types
- `FromIterator`/`Extend` implementations for building token streams
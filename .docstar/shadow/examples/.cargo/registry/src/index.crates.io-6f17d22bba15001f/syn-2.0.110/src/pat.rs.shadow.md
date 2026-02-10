# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/pat.rs
@source-hash: b6c8c04c330a76db
@generated: 2026-02-09T18:12:05Z

Provides AST types and parsing/printing for Rust pattern syntax. Part of the syn crate's syntax tree representation for procedural macros.

## Core Pattern Types

**Pat enum (L26-82)** - Main pattern type representing all Rust pattern syntaxes:
- Const: const blocks `const { ... }` (L28)
- Ident: binding patterns `ref mut binding @ SUBPATTERN` (L31)
- Lit: literal patterns `0` (L34)
- Macro: macro patterns (L37)
- Or: alternative patterns `A | B` (L40)
- Paren: parenthesized patterns `(A | B)` (L43)
- Path: path patterns `Color::Red`, qualified/unqualified (L52)
- Range: range patterns `1..=2` (L55)
- Reference: reference patterns `&mut var` (L58)
- Rest: rest patterns `..` in tuples/slices (L61)
- Slice: slice patterns `[a, b, ..]` (L64)
- Struct: struct patterns `Variant { x, y, .. }` (L67)
- Tuple: tuple patterns `(a, b)` (L70)
- TupleStruct: tuple struct patterns `Variant(x, y)` (L73)
- Type: type ascription `foo: f64` (L76)
- Verbatim: unparsed tokens (L79)
- Wild: wildcard `_` (L82)

## Pattern Struct Types

**PatIdent (L110-116)** - Variable binding patterns with optional ref/mut modifiers and subpatterns
**PatOr (L122-126)** - Or-patterns with optional leading `|` and punctuated cases
**PatStruct (L172-179)** - Struct destructuring with path, fields, and optional rest
**PatTuple (L185-189)** - Tuple patterns with parentheses and comma-separated elements
**FieldPat (L230-235)** - Individual struct field patterns with member and optional colon

## Parsing Implementation (L238-805)

**Pat::parse_single() (L287-330)** - Parses patterns without top-level `|` (for function parameters)
**Pat::parse_multi() (L333-335)** - Parses patterns with `|` but no leading `|`
**Pat::parse_multi_with_leading_vert() (L379-382)** - Parses patterns with optional leading `|` (for match arms)

Key parsing functions:
- `pat_path_or_macro_or_struct_or_range()` (L419-454) - Disambiguates path-like patterns
- `pat_paren_or_tuple()` (L643-671) - Distinguishes parentheses from tuples
- `pat_slice()` (L759-792) - Handles slice patterns with range validation
- `PatRangeBound` enum (L702-724) - Helper for range pattern bounds

## Printing Implementation (L808-955)

ToTokens implementations for all pattern types, handling proper formatting and precedence.

## Dependencies

- `crate::expr` - Reuses expression types for const/lit/macro/path/range patterns (L10-13)
- `crate::punctuated::Punctuated` - For comma-separated lists
- `crate::path::{Path, QSelf}` - For qualified paths
- `proc_macro2::TokenStream` - For verbatim token handling

## Key Design Patterns

- Uses `ast_enum_of_structs!` macro for main Pat enum with exhaustiveness testing guidance (L84-100)
- Reuses expression types where semantically equivalent (L10-13)
- Provides multiple parsing entry points for different syntactic contexts
- Handles ambiguous syntax through lookahead and backtracking
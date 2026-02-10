# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/src/parse.rs
@source-hash: 0c380fdbe8795d41
@generated: 2026-02-09T18:11:57Z

**Tokenizer and Parser for Rust proc-macro2**

Primary purpose: Core tokenization engine for parsing Rust code into TokenStream components, serving as the fallback implementation for proc-macro2 when native compiler support is unavailable.

## Key Components

**Cursor struct (L10-72)**: String slice iterator with position tracking. Core parsing primitive that advances through input while maintaining span location information. Key methods:
- `advance()` (L17): Creates new cursor at offset position
- `starts_with()` (L26): Pattern matching at current position
- `parse()` (L65): Consumes literal string or returns Reject

**Main Parsing Functions**:
- `token_stream()` (L168-251): Main entry point that parses complete token stream, handling nested delimiters via stack-based parsing
- `leaf_token()` (L266-281): Dispatches to specific token type parsers (literal, punct, ident)
- `skip_whitespace()` (L77-123): Advances past whitespace and comments, handling line/block comment exclusions for doc comments

**Literal Parsing (L337-869)**:
- `literal()` (L337): Main literal dispatcher
- String variants: `string()` (L370), `cooked_string()` (L380), `raw_string()` (L414)
- Byte variants: `byte_string()` (L433), `cooked_byte_string()` (L443), `raw_byte_string()` (L491)
- C string variants: `c_string()` (L514), `cooked_c_string()` (L544), `raw_c_string()` (L524)
- Character/byte literals: `character()` (L603), `byte()` (L581)
- Numeric literals: `float()` (L711), `int()` (L806)
- Escape sequence handlers: `backslash_u()` (L666), `backslash_x_char()` (L635)

**Identifier Parsing**:
- `ident()` (L283): Main identifier parser with raw string literal exclusion
- `ident_any()` (L296): Handles raw identifiers (`r#name`) with keyword validation
- `ident_not_raw()` (L318): Parses non-raw identifiers following Unicode XID rules

**Punctuation Parsing**:
- `punct()` (L871): Parses punctuation with spacing determination (Joint/Alone)
- `punct_char()` (L891): Recognizes valid punctuation characters from predefined set

**Doc Comment Processing**:
- `doc_comment()` (L912-958): Converts doc comments into attribute tokens (`#[doc = "..."]`)
- `doc_comment_contents()` (L960-981): Extracts content from `///`, `//!`, `/**`, `/*!` patterns

## Architecture Patterns

**Error Handling**: Uses `Reject` marker type (L74) with `PResult<'a, O>` alias (L75) for backtracking-based parsing. Failed parses return `Reject` rather than consuming input.

**Span Management**: Conditional compilation (`#[cfg(span_locations)]`) integrates position tracking for error reporting and macro hygiene.

**Delimiter Stack**: `token_stream()` uses Vec stack to track nested parentheses, brackets, and braces with proper matching validation.

**Unicode Support**: Full Unicode identifier support via `is_ident_start`/`is_ident_continue` from fallback module, plus extended whitespace recognition including RTL/LTR marks.

## Critical Invariants

- Cursor advancement must respect UTF-8 character boundaries
- Raw string delimiter length limited to 255 characters (L478-481)
- Doc comments must not contain bare CR characters (L925-931)
- C strings reject null bytes in content (L537, L574)
- Numeric literals require valid digit sequences for their base

**Dependencies**: Imports fallback tokenizer components and core string iteration utilities. Integrates with proc-macro2's main TokenTree/TokenStream types.
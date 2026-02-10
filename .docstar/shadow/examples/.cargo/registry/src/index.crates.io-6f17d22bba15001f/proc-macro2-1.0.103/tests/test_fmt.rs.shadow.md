# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/tests/test_fmt.rs
@source-hash: b7743b612af65f2c
@generated: 2026-02-09T18:11:41Z

## Purpose
Test file verifying the formatting behavior of proc-macro2's Group type with different delimiters, ensuring compatibility with libproc_macro's string representation.

## Key Functions
- **test_fmt_group (L6-28)**: Tests Group formatting across all delimiter types (parentheses, brackets, braces, none) with both empty and non-empty token streams

## Test Structure
Creates systematic test cases for Group formatting:
- Uses single identifier "x" as test content (L8-9)
- Tests all four delimiter types: Parenthesis, Bracket, Brace, None (L10-17)
- Validates both empty and non-empty variants for each delimiter
- Assertions verify exact string output matches libproc_macro behavior (L20-27)

## Dependencies
- **proc_macro2**: Core types (Delimiter, Group, Ident, Span, TokenStream, TokenTree)
- **std::iter**: For token stream construction

## Key Behaviors Tested
- Parentheses: "()" empty, "(x)" with content
- Brackets: "[]" empty, "[x]" with content  
- Braces: "{ }" empty (note spaces), "{ x }" with content (note spaces)
- None delimiter: "" empty (invisible), "x" with content (unwrapped)

## Critical Invariants
- Brace groups always include internal spacing for formatting
- None delimiter groups are invisible when empty, unwrapped when containing tokens
- All formatting must match libproc_macro's canonical representation
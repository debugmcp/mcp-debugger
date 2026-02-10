# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/mac.rs
@source-hash: fdce8291f71adef3
@generated: 2026-02-09T18:11:57Z

## Purpose and Responsibility

This file defines AST structures and parsing/printing implementations for Rust macro invocations in the syn crate. It provides the core types `Macro` and `MacroDelimiter` to represent macro calls like `println!("{}", value)` with proper delimiter handling.

## Key Structures

### Macro (L17-23)
Core AST node representing a macro invocation with four fields:
- `path`: The macro name/path (e.g., `println` or `std::println`)
- `bang_token`: The `!` token
- `delimiter`: The surrounding delimiters (parentheses, braces, or brackets)
- `tokens`: The actual macro body as a token stream

Key methods:
- `parse_body<T>()` (L138-140): Parses macro body tokens into a syntax tree using the `Parse` trait
- `parse_body_with<F>()` (L146-149): Parses macro body using a custom parser function, providing proper span context

### MacroDelimiter (L28-33)
Enum representing the three possible macro delimiter types:
- `Paren(Paren)`: Parentheses `()`
- `Brace(Brace)`: Braces `{}`
- `Bracket(Bracket)`: Brackets `[]`

Key methods:
- `span()` (L36-42): Returns delimiter span information
- `is_brace()` (L45-50): Helper to check if delimiter is braces (feature-gated)

## Parsing Implementation

### parse_delimiter (L153-170)
Internal function that extracts delimiter and token stream from input, converting proc_macro2::Delimiter to MacroDelimiter. Rejects `Delimiter::None`.

### Parse trait for Macro (L180-194)
Located in `parsing` module, implements parsing logic:
1. Parse path in module style
2. Parse bang token
3. Parse delimiter and extract content
4. Construct Macro struct

## Printing Implementation

### MacroDelimiter::surround (L207-215)
Helper method that wraps tokens with appropriate delimiters for output generation.

### ToTokens for Macro (L218-224)
Reconstructs macro invocation syntax by:
1. Printing path in module style
2. Adding bang token
3. Surrounding tokens with proper delimiters

## Dependencies and Feature Gates

- Core dependencies: `proc_macro2`, `crate::path`, `crate::token`
- Parsing features: Conditionally compiled under "parsing" feature
- Printing features: Conditionally compiled under "printing" feature
- Uses `ast_struct!` and `ast_enum!` macros for AST node generation

## Architectural Patterns

- Feature-gated compilation for parsing vs printing functionality
- Separation of concerns with dedicated parsing/printing modules
- Error handling through syn's Result type with proper span information
- Integration with proc_macro2's token stream and delimiter types
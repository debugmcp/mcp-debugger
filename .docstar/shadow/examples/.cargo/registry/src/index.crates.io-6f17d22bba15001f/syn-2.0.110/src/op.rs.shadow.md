# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/op.rs
@source-hash: a61757370f802e44
@generated: 2026-02-09T18:12:17Z

## Purpose
Defines operator AST nodes for the syn parsing library. Provides comprehensive enum definitions for binary and unary operators used in Rust syntax parsing, along with parsing and token generation implementations.

## Key Types

**BinOp enum (L5-62)**: Represents all binary operators in Rust syntax
- Arithmetic: `Add`, `Sub`, `Mul`, `Div`, `Rem` (L7-15)
- Logical: `And` (&&), `Or` (||) (L16-19)
- Bitwise: `BitXor`, `BitAnd`, `BitOr`, `Shl`, `Shr` (L20-29)
- Comparison: `Eq`, `Lt`, `Le`, `Ne`, `Ge`, `Gt` (L30-41)
- Assignment: `AddAssign`, `SubAssign`, `MulAssign`, `DivAssign`, `RemAssign`, `BitXorAssign`, `BitAndAssign`, `BitOrAssign`, `ShlAssign`, `ShrAssign` (L42-61)

**UnOp enum (L69-76)**: Represents unary operators
- `Deref` (*), `Not` (!), `Neg` (-) operators

Each variant wraps a corresponding `Token![]` type from syn's token system.

## Feature-Gated Implementations

**Parsing Module (L80-165)**: Available with "parsing" feature
- `Parse` impl for `BinOp` (L86-148): Uses precedence-aware if-else chain, parsing compound operators first (assignments, multi-char operators) before single-char operators
- `Parse` impl for `UnOp` (L151-164): Uses lookahead for efficient token recognition

**Printing Module (L167-219)**: Available with "printing" feature  
- `ToTokens` impl for `BinOp` (L174-207): Delegates to wrapped token's `to_tokens`
- `ToTokens` impl for `UnOp` (L210-218): Simple match forwarding to token

## Architectural Patterns
- Uses syn's `ast_enum!` macro for consistent AST node generation
- Feature-gated conditional compilation for parsing/printing capabilities
- Operator precedence handled implicitly through parsing order in `BinOp::parse`
- Direct token wrapping pattern - each operator variant contains its literal token representation

## Dependencies
- Core: syn's token system (`Token![]` macro)
- Parsing: `crate::parse::{Parse, ParseStream}`, `crate::error::Result`
- Printing: `proc_macro2::TokenStream`, `quote::ToTokens`

## Critical Design Notes
- `#[non_exhaustive]` attribute allows future operator additions without breaking changes
- Parsing order in `BinOp::parse` is significant - compound operators must be checked before their constituent characters
- Both enums are conditionally documented based on enabled features
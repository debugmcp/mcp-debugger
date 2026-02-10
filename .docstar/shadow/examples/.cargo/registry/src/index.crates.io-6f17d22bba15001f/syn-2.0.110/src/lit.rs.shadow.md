# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/lit.rs
@source-hash: 69ef534be9ba43de
@generated: 2026-02-09T18:12:02Z

Defines Rust literal types and parsing for the syn crate, providing AST representations for all Rust literal forms with span information and value extraction capabilities.

## Core Types

**Lit enum (L26-55)**: Main enum representing all Rust literals including strings, integers, floats, booleans, bytes, characters, C-strings, and verbatim tokens.

**Literal wrapper structs**: Each literal type has a dedicated struct:
- `LitStr` (L60-62): UTF-8 string literals with parsing capabilities
- `LitByteStr` (L67-69): Byte string literals 
- `LitCStr` (L74-76): C-string literals
- `LitByte` (L81-83): Single byte literals
- `LitChar` (L88-90): Character literals
- `LitInt` (L100-102): Integer literals with base conversion
- `LitFloat` (L115-117): Floating-point literals
- `LitBool` (L128-131): Boolean literals (true/false)

## Internal Representation

**LitRepr (L93-96)**: Basic representation storing proc_macro2::Literal token and suffix
**LitIntRepr (L105-109)**: Integer-specific representation with digits, token, and suffix
**LitFloatRepr (L120-124)**: Float-specific representation with digits, token, and suffix

## Key Methods

**Construction methods**: Each literal type provides `new()` methods for creating instances with spans
**Value extraction**: `value()` methods return parsed native types (String, Vec<u8>, char, etc.)
**Span management**: `span()`, `set_span()` for source location tracking
**Token access**: `token()` methods return underlying proc_macro2::Literal

## Special Features

**LitStr parsing (L185-257)**: Advanced parsing methods `parse()` and `parse_with()` that can parse string literal contents into other syntax tree nodes with proper span handling

**Negative literal handling (L904-941)**: Special parsing for negative integers and floats by combining minus sign with literal

## Parsing Infrastructure

**Parse implementations (L873-1029)**: Complete Parse trait implementations for all literal types with proper error messages

**Token trait implementations (L1038-1065)**: Enables literals as tokens in parsing contexts

## Value Parsing Module (L1131-1918)

Comprehensive literal value parsing with:
- String literal parsing (cooked and raw strings) (L1300-1399)
- Byte string parsing (L1402-1478) 
- C-string parsing with null-byte validation (L1481-1572)
- Character and byte parsing with escape sequence handling
- Integer parsing supporting multiple bases (binary, octal, hex) (L1737-1825)
- Float parsing with exponent notation (L1828-1917)

## Feature Gating

- Parsing functionality gated behind "parsing" feature
- Debug implementations under "extra-traits" feature
- Clone implementations under "clone-impls" feature
- Printing (ToTokens) under "printing" feature

The module provides complete literal handling for procedural macros, with robust parsing, proper error handling, and span preservation throughout transformations.
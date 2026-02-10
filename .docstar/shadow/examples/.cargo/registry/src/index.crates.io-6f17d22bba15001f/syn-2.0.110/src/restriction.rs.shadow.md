# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/restriction.rs
@source-hash: a7152ec5a4ee4f55
@generated: 2026-02-09T18:12:18Z

## Purpose
Defines Rust visibility level representations for the syn parser, handling `pub`, `pub(restricted)`, and inherited visibility patterns. Part of the syn crate's AST node definitions.

## Core Types

### Visibility (L14-24)
Main enum representing visibility levels with three variants:
- `Public(Token![pub])` - Simple public visibility
- `Restricted(VisRestricted)` - Path-restricted visibility like `pub(crate)` or `pub(in some::module)`
- `Inherited` - Default private visibility

### VisRestricted (L31-36)  
Structure for restricted visibility containing:
- `pub_token: Token![pub]` - The `pub` keyword
- `paren_token: token::Paren` - Parentheses tokens
- `in_token: Option<Token![in]>` - Optional `in` keyword for module paths
- `path: Box<Path>` - The restriction path (self/super/crate/module path)

### FieldMutability (L43-56)
Placeholder enum for RFC 3323 field mutability restrictions, currently only contains `None` variant.

## Key Implementations

### Parsing (L60-145)
- `Visibility::parse()` (L72-90) - Main parser handling empty groups from `$:vis` matchers and `pub` tokens
- `Visibility::parse_pub()` (L93-135) - Specialized parser for `pub` visibility variants, distinguishes between simple `pub` and restricted forms like `pub(crate)`, `pub(self)`, `pub(super)`, and `pub(in path::to::module)`
- `Visibility::is_some()` (L138-143) - Utility to check if visibility is explicitly specified

### Printing (L148-178)
- `ToTokens` implementations for both `Visibility` (L156-164) and `VisRestricted` (L167-177)
- Handles token stream generation for all visibility variants

## Dependencies
- `crate::path::Path` - For module path representations
- `crate::token` - Token type definitions
- Standard syn parsing/printing infrastructure

## Architecture Notes
- Uses syn's `ast_enum!` and `ast_struct!` macros for consistent AST node generation
- Feature-gated implementations (`parsing`, `printing`, `full`) for modular compilation
- Speculative parsing approach to avoid misinterpreting tuple fields as restricted visibility
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/common/visit.rs
@source-hash: a260ecd2ce7853cd
@generated: 2026-02-09T18:06:26Z

## Purpose
Test utilities for normalizing Rust AST structures by implementing mutable visitors that transform parsed syntax trees to match their printed representation. Used in syn's test suite to ensure parsing and printing consistency.

## Key Components

### FlattenParens (L6-42)
AST visitor that removes unnecessary parentheses from expressions and token streams.
- `discard_paren_attrs: bool` - Controls whether parentheses attributes are preserved or discarded
- `discard_attrs()` (L11-15) - Constructor that discards parentheses attributes
- `combine_attrs()` (L17-21) - Constructor that preserves attributes by moving them to inner expressions
- `visit_token_stream_mut()` (L23-41) - Static method that recursively flattens parentheses in token streams

### AsIfPrinted (L64-119)
AST visitor that normalizes syntax trees to match their pretty-printed form by removing redundant tokens.
- `visit_file_mut()` (L67-70) - Removes shebang from files
- `visit_generics_mut()` (L72-83) - Removes empty generic angle brackets and where clauses
- `visit_lifetime_param_mut()` (L85-90) - Removes colon tokens from lifetime parameters without bounds
- `visit_stmt_mut()` (L92-111) - Converts macro expressions to macro statements when appropriate
- `visit_type_param_mut()` (L113-118) - Removes colon tokens from type parameters without bounds

## Dependencies
- `proc_macro2` - Token manipulation for parentheses flattening
- `syn::visit_mut` - Mutable AST visitor framework
- `syn` - Core AST types (Expr, File, Generics, etc.)

## Patterns
- Both visitors use the visitor pattern to traverse and modify AST nodes in-place
- Extensive use of `mem::take()` and `mem::replace()` for safe mutation without cloning
- Recursive token stream processing in `visit_token_stream_mut()`
- Pattern matching on expression and statement variants for targeted transformations
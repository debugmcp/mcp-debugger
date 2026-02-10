# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/test_generics.rs
@source-hash: 0d79a25b75e45779
@generated: 2026-02-09T18:12:01Z

## Purpose
Test suite for the `syn` crate's generic parameter parsing functionality, validating correct AST generation for generics, lifetimes, type parameters, where clauses, and trait bounds.

## Key Test Functions

### `test_split_for_impl()` (L20-133)
- Tests parsing of complex generic struct with lifetime bounds, attributes, and where clauses
- Validates `split_for_impl()` method that separates generics into impl/type/where components for code generation
- Tests `as_turbofish()` method for turbofish operator syntax generation
- Uses snapshot testing to verify exact AST structure

### `test_type_param_bound()` (L135-213)
- Tests parsing of various `TypeParamBound` variants:
  - Lifetime bounds (`'a`, `'_`)
  - Trait bounds (`Debug`)
  - Maybe bounds (`?Sized`)
  - Higher-ranked trait bounds (`for<'a> Trait`)
- Validates error handling for invalid syntax combinations (L200-212)

### `test_fn_precedence_in_where_clause()` (L215-314)
- Tests operator precedence in where clause parsing
- Ensures `FnOnce() -> i32 + Send` parses as two separate bounds, not `FnOnce() -> (i32 + Send)`
- Validates complex function signature parsing with generics and where clauses

### `test_where_clause_at_end_of_input()` (L316-325)
- Edge case test for empty where clauses
- Ensures parser handles incomplete input gracefully

### `no_opaque_drop()` (L328-345)
- Regression test for issue #1718
- Tests lifetime insertion into `Generics` without triggering opaque drop behavior
- Validates `lifetimes()` iterator and dynamic generic parameter modification

## Dependencies
- `quote` crate for token generation (L14)
- `syn` types: `DeriveInput`, `GenericParam`, `Generics`, `ItemFn`, `Lifetime`, etc. (L15-18)
- Local modules: `snapshot` for test assertions (L10), `debug` utilities (L12)

## Key Patterns
- Extensive use of `snapshot!` macro for AST structure validation
- `quote!` macro for generating test token streams
- Pattern matching on AST enums (`WherePredicate::Type`, `GenericParam::Lifetime`)
- String comparison of generated code via `to_string()`

## Testing Strategy
- Snapshot-based testing ensures AST structure stability across releases
- Error case validation for malformed syntax
- Regression tests for specific GitHub issues
- Complex generic scenarios with multiple lifetime bounds and attributes
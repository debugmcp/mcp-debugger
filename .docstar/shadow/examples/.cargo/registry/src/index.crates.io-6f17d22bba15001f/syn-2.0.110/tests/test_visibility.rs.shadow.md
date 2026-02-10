# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/test_visibility.rs
@source-hash: 7d05f05b07829763
@generated: 2026-02-09T18:12:12Z

## Purpose and Responsibility
Test suite for syn crate's visibility parsing functionality. Validates that various Rust visibility modifiers (`pub`, `pub(crate)`, `pub(in path)`, etc.) are correctly parsed into `syn::Visibility` enum variants.

## Key Components

### VisRest Struct (L17-21)
Helper struct combining a `Visibility` and remaining `TokenStream`. Implements `Parse` trait (L23-30) to facilitate testing visibility parsing by capturing both the parsed visibility and any remaining tokens.

### assert_vis_parse! Macro (L32-54)
Core testing macro with three variants:
- `Ok(pattern)`: Expects successful parse matching pattern with no remaining tokens
- `Ok(pattern) + rest`: Expects successful parse with specific remaining tokens  
- `Err`: Expects parsing failure

Uses round-trip string comparison (L48) to avoid whitespace differences in token stream validation.

### Test Functions (L56-145)
Comprehensive test coverage for visibility variants:
- `test_pub` (L56): Basic `pub` visibility
- `test_inherited` (L61): Empty/inherited visibility  
- `test_in` (L66): Path-restricted `pub(in foo::bar)`
- `test_pub_crate/self/super` (L71-84): Module-relative restrictions
- `test_missing_in` (L86): Malformed syntax handling
- `test_crate_path` (L96): Complex path scenarios
- `test_junk_after_in` (L104): Error case with invalid tokens

### Complex Token Stream Tests (L109-191)
Two sophisticated tests constructing raw `TokenStream`s to simulate macro-generated code:
- `test_inherited_vis_named_field` (L109): Tests inherited visibility in struct fields with named fields
- `test_inherited_vis_unnamed_field` (L147): Tests inherited visibility in tuple struct fields

Both use `snapshot!` macro for detailed AST structure validation and manually construct token streams using `proc_macro2` primitives.

## Dependencies
- `syn`: Primary parsing library being tested
- `proc_macro2`: Token manipulation primitives
- `quote`: Token stream generation utilities
- Local `snapshot` and `debug` modules for test infrastructure

## Architecture Notes
- Follows pattern-matching testing approach using macro-driven assertions
- Separates simple string-based tests from complex token-stream construction tests
- Uses snapshot testing for comprehensive AST validation in edge cases
- Tests both successful parsing and error conditions systematically
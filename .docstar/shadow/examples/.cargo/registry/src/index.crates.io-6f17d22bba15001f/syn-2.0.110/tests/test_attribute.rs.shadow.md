# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/test_attribute.rs
@source-hash: 8a4429b7cfe2360b
@generated: 2026-02-09T18:12:01Z

## Purpose
Unit test file for `syn` crate's attribute parsing functionality, specifically testing the parsing of Rust attribute syntax into `Meta` enum variants.

## Key Components

### Test Helper Function
- `test(input: &str) -> Meta` (L224-231): Parses attribute string using `Attribute::parse_outer`, extracts first attribute's meta field. Core helper for all test cases.

### Test Cases for Meta Variants

**Path Attributes (Simple Names)**
- `test_meta_item_word()` (L16-28): Tests `#[foo]` → `Meta::Path` with single path segment

**NameValue Attributes** 
- `test_meta_item_name_value()` (L31-48): Tests `#[foo = 5]` → `Meta::NameValue` with literal value
- `test_meta_item_bool_value()` (L51-89): Tests boolean literals `#[foo = true]` and `#[foo = false]` → `Meta::NameValue`

**List Attributes (Parenthesized)**
- `test_meta_item_list_lit()` (L92-108): Tests `#[foo(5)]` → `Meta::List` with literal token
- `test_meta_item_list_word()` (L111-127): Tests `#[foo(bar)]` → `Meta::List` with identifier token  
- `test_meta_item_list_name_value()` (L130-146): Tests `#[foo(bar = 5)]` → `Meta::List` with name-value tokens
- `test_meta_item_list_bool_value()` (L149-165): Tests `#[foo(bar = true)]` → `Meta::List` with boolean tokens
- `test_meta_item_multiple()` (L168-184): Tests complex multi-element list `#[foo(word, name = 5, list(name2 = 6), word2)]`

**Edge Cases**
- `test_bool_lit()` (L187-203): Tests bare boolean in list `#[foo(true)]`
- `test_negative_lit()` (L206-222): Tests negative numbers `#[form(min = -1, max = 200)]`

## Dependencies
- `syn::parse::Parser` (L12): For parsing functionality
- `syn::{Attribute, Meta}` (L13): Core attribute and metadata types
- `snapshot` module (L8): Custom macro for assertion testing (likely generates snapshot comparisons)
- `debug` module (L10): Supporting debug utilities

## Architecture Pattern
Uses snapshot testing pattern where each test parses an attribute string and compares the resulting AST structure against expected output using `snapshot!` macro. All tests follow same pattern: parse → snapshot comparison.

## Key Invariants
- All tests expect exactly one attribute in parsed result (assertion on L227)
- Tests cover all three `Meta` enum variants: `Path`, `NameValue`, and `List`
- Token streams in `Meta::List` preserve original spacing and structure
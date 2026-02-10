# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/test_derive_input.rs
@source-hash: c8f5dbac6482dadd
@generated: 2026-02-09T18:12:03Z

## Purpose

Test suite for `syn` crate's `DeriveInput` parsing functionality, specifically validating how the parser handles various Rust struct, enum, and union declarations and converts them into abstract syntax tree representations.

## Key Test Functions

- `test_unit()` (L18-35): Tests parsing of unit structs (`struct Unit;`)
- `test_struct()` (L37-132): Tests parsing of regular structs with attributes, visibility modifiers, and named fields
- `test_union()` (L134-185): Tests parsing of union types with generic parameters
- `test_enum()` (L187-348): Tests parsing of enums with complex variants, discriminants, and proc-macro hack patterns (requires "full" feature)
- `test_attr_with_non_mod_style_path()` (L350-358): Negative test ensuring invalid attribute syntax fails
- `test_attr_with_mod_style_path_with_self()` (L360-408): Tests attribute paths containing `self`
- `test_pub_restricted()` (L410-465): Tests restricted visibility (`pub(in m)`) parsing
- `test_pub_restricted_crate()` (L467-492): Tests crate-scoped visibility (`pub(crate)`)  
- `test_pub_restricted_super()` (L494-519): Tests super-scoped visibility (`pub(super)`)
- `test_pub_restricted_in_super()` (L521-547): Tests explicit in-super visibility (`pub(in super)`)
- `test_fields_on_unit_struct()` (L549-573): Tests field iteration on unit structs
- `test_fields_on_named_struct()` (L575-665): Tests field iteration on structs with named fields
- `test_fields_on_tuple_struct()` (L667-746): Tests field iteration on tuple structs
- `test_ambiguous_crate()` (L748-785): Tests disambiguation of crate keyword in type paths

## Dependencies and Architecture

- Uses `quote!` macro for generating token streams from Rust syntax
- Imports `syn::{Data, DeriveInput}` for AST types
- Depends on custom `snapshot!` macro (defined in imported `snapshot` module L10-11) for assertion testing
- Utilizes `debug` module (L13) for additional debugging functionality

## Testing Pattern

Each test follows the pattern:
1. Generate Rust code using `quote!` macro
2. Parse into `DeriveInput` AST using `snapshot!` macro
3. Assert against expected AST structure with detailed field-by-field comparison
4. Some tests perform additional validation of specific AST components

## Notable Features

- Comprehensive coverage of Rust's visibility modifiers and generic syntax
- Tests edge cases like proc-macro hack patterns in enum discriminants (L196-201)
- Validates both successful parsing and expected parsing failures
- Tests field iteration interfaces for different struct types
- Handles complex nested attribute structures and path resolution
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/test_receiver.rs
@source-hash: 2053028236f95f3c
@generated: 2026-02-09T18:12:04Z

## Purpose

Test suite for `syn` crate's receiver parsing functionality, specifically testing how different `self` parameter patterns in trait method signatures are parsed into `Receiver` AST nodes.

## Key Test Functions

- **test_by_value** (L14-33): Tests explicit `self: Self` receiver type parsing
- **test_by_mut_value** (L35-55): Tests mutable explicit receiver `mut self: Self` 
- **test_by_ref** (L57-78): Tests reference receiver `self: &Self`
- **test_by_box** (L80-112): Tests boxed receiver `self: Box<Self>`
- **test_by_pin** (L114-146): Tests pinned receiver `self: Pin<Self>`
- **test_explicit_type** (L148-180): Tests custom type receiver `self: Pin<MyType>`
- **test_value_shorthand** (L182-200): Tests shorthand value receiver `self`
- **test_mut_value_shorthand** (L202-221): Tests shorthand mutable receiver `mut self`
- **test_ref_shorthand** (L223-244): Tests shorthand reference receiver `&self`
- **test_ref_shorthand_with_lifetime** (L246-272): Tests reference receiver with lifetime `&'a self`
- **test_ref_mut_shorthand** (L274-297): Tests mutable reference shorthand `&mut self`
- **test_ref_mut_shorthand_with_lifetime** (L299-327): Tests mutable reference with lifetime `&'a mut self`

## Dependencies

- **syn** (L12): Core parsing library, uses `parse_quote!` macro and `TraitItemFn` type
- **snapshot module** (L8): Custom testing utility for AST structure verification
- **debug module** (L10): Additional debugging support

## Architecture Pattern

Each test follows identical structure:
1. Parse trait method signature using `parse_quote!` macro
2. Extract first function argument (`sig.inputs[0]`)  
3. Use `snapshot!` macro to verify exact AST structure matches expected `Receiver` representation

## Key Insights

- Tests comprehensive receiver syntax variations (explicit vs shorthand, mutable, references, lifetimes)
- Validates `Receiver` AST node fields: `colon_token`, `mutability`, `reference`, `ty`
- Demonstrates `syn`'s ability to distinguish between syntactic forms that have same semantic meaning
- Shows how different `self` patterns map to consistent `Receiver` structure with varying field presence
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/test_expr.rs
@source-hash: 055cb9b33a5bb6ed
@generated: 2026-02-09T18:12:08Z

Test file for Rust expression parsing in the `syn` crate. Contains comprehensive test coverage for expression parsing, precedence, and AST structure validation.

## Primary Purpose

This file tests the parsing capabilities of `syn` for various Rust expressions, ensuring correct AST representation, operator precedence, and parsing edge cases.

## Key Test Functions

- `test_expr_parse` (L39-60): Basic expression parsing tests for range expressions
- `test_await` (L62-80): Tests await expression parsing to avoid confusion with field access
- `test_tuple_multi_index` (L83-127): Tests parsing of chained tuple field access with various whitespace configurations
- `test_macro_variable_func` (L129-193): Tests parsing of macro-generated function calls
- `test_macro_variable_macro` (L195-216): Tests macro invocation parsing
- `test_macro_variable_struct` (L218-235): Tests struct literal parsing
- `test_macro_variable_unary` (L237-260): Tests unary operator parsing with macro variables
- `test_macro_variable_match_arm` (L262-335): Tests match arm expression parsing
- `test_closure_vs_rangefull` (L338-353): Tests disambiguation between closures and range expressions
- `test_postfix_operator_after_cast` (L355-359): Tests invalid postfix operations after casts
- `test_range_kinds` (L361-377): Tests various range expression forms
- `test_range_precedence` (L379-428): Tests operator precedence with ranges
- `test_range_attrs` (L430-475): Tests attribute placement on range expressions
- `test_ranges_bailout` (L477-569): Tests range parsing edge cases and bailout scenarios
- `test_ambiguous_label` (L571-598): Tests label parsing in break/continue expressions
- `test_extended_interpolated_path` (L600-706): Tests path parsing with macro interpolation
- `test_tuple_comma` (L708-760): Tests tuple comma handling and single-element tuples
- `test_binop_associativity` (L762-792): Tests binary operator associativity rules
- `test_assign_range_precedence` (L794-823): Tests precedence between assignment and range operators
- `test_chained_comparison` (L825-840): Tests error handling for chained comparison operators
- `test_fixup` (L842-911): Tests expression parenthesization and reconstruction
- `test_permutations` (L913-1701): Comprehensive permutation testing of expression combinations

## Key Dependencies

- `syn` crate types: `Expr`, `ExprRange`, `ExprPath`, `BinOp`, etc. (L28-37)
- `quote` macro for token generation (L24)
- `proc_macro2` for token manipulation (L23)
- Custom visitor modules: `AsIfPrinted`, `FlattenParens` (L22)

## Test Infrastructure

Uses custom `snapshot!` macro (from imported `snapshot` module) for AST structure validation and comparison. The tests verify both successful parsing and appropriate error handling for invalid expressions.

## Expression Coverage

Tests cover most Rust expression types including:
- Binary operations and precedence
- Range expressions (all variants)
- Function calls and method calls
- Field access and indexing
- Control flow (if, match, loop, break, return)
- Closures and async/await
- Type casts and references
- Macro invocations
- Tuple and struct literals

## Notable Patterns

The `test_permutations` function (L913-1701) generates systematic combinations of expressions to test parsing consistency and parenthesization behavior, using a recursive approach with depth limiting.
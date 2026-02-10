# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/test_precedence.rs
@source-hash: ed27331fe3bc4496
@generated: 2026-02-09T18:12:15Z

## Purpose
Test file for syn's expression parsing and operator precedence handling by comparing against rustc's parser. Validates that syn and rustc produce identical ASTs when expressions are fully parenthesized, ensuring expression precedence is handled identically between the two parsers.

## Key Functions

**`test_rustc_precedence` (L65-116)**: Main test function that processes all Rust files in the rust-lang/rust repository. Initializes parallel processing, iterates through files, and aggregates test results with early termination on excessive failures.

**`test_expressions` (L118-198)**: Core testing logic that processes individual expressions from a file. For each expression:
- Parses with both syn and rustc
- Applies full parenthesization to both ASTs
- Compares results for equivalence
- Tests invisible delimiter handling
- Validates expression scanning

**`librustc_parse_and_rewrite` (L200-202)**: Wrapper that parses expressions with rustc and applies parenthesization.

**`librustc_parenthesize` (L204-384)**: Implements `MutVisitor` to add parentheses around all subexpressions in rustc ASTs, with special handling for:
- Let chains in binary expressions (L220-229)
- Block expressions, if statements, and let expressions (L284-285)
- Const generic arguments (L299-310)
- Statement-level expressions (L240-255)

**`syn_parenthesize` (L386-479)**: Implements `Fold` trait to add parentheses around syn expressions, mirroring the rustc implementation with equivalent special cases for let chains and const generics.

**`make_parens_invisible` (L481-518)**: Converts explicit parentheses to invisible group delimiters for testing parser robustness.

**`collect_exprs` (L521-558)**: Traverses syn AST using `Fold` trait to extract all expressions while avoiding patterns, paths, and const parameters.

## Key Data Structures

**`FullyParenthesize` (L218, L392)**: Visitor implementations for both rustc and syn that wrap subexpressions in parentheses while preserving semantic equivalence.

**`MakeParensInvisible` (L485)**: Folder that converts parentheses to invisible group tokens for delimiter handling tests.

**`CollectExprs` (L526)**: Folder that accumulates expressions from a file while skipping non-expression nodes.

## Dependencies
- External rustc crates for AST manipulation and parsing (L35-41)
- `SpanlessEq` for AST comparison ignoring source spans (L43)
- `repo` module for Rust repository handling and parallel processing (L60)
- `scan_expr` module for expression scanning validation (L62-63)

## Architecture Patterns
- Visitor pattern implementation for both rustc and syn ASTs
- Parallel file processing with atomic counters for thread-safe result aggregation
- Fold-based AST transformation for expression collection and modification
- Span-agnostic AST comparison for semantic equivalence testing

## Critical Invariants
- Let chains in binary expressions must not be parenthesized (L285, L406)
- Block expressions, if statements, and let expressions remain unparenthesized (L284-285, L405)
- Const generic arguments receive special parenthesization handling (L304-309, L433-442)
- Statement-level expressions are not wrapped in additional parentheses (L243-250, L444-451)
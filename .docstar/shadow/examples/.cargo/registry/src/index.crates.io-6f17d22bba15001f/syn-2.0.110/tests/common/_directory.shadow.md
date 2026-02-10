# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/common/
@generated: 2026-02-09T18:16:09Z

## Purpose and Responsibility

The `tests/common` module provides comprehensive testing infrastructure for the `syn` crate, focusing on AST comparison, parsing validation, and syntax tree normalization. It enables robust testing of syn's parser by providing utilities to compare syn's output against rustc's official parser and ensure consistency between parsing and pretty-printing operations.

## Key Components

### SpanlessEq Framework (`eq.rs`)
Core testing utility for semantic AST comparison while ignoring source location information:
- **`SpanlessEq` trait**: Defines span-agnostic equality comparison for all AST node types
- **Comprehensive implementations**: Auto-generated via macros for all rustc AST types, primitives, and collections
- **Token stream handling**: Special logic for doc comment expansion and cross-platform string normalization
- **Error recovery support**: Handles parsing error scenarios in function parameters

### Parser Validation (`parse.rs`) 
Dual-parser testing utilities for validating syn against rustc:
- **`librustc_expr()`**: Parses expressions using official rustc compiler with crash protection
- **`syn_expr()`**: Parses expressions using syn crate for direct comparison
- **Error isolation**: Prevents rustc parsing crashes from affecting test execution

### AST Normalization (`visit.rs`)
Mutable visitors for normalizing parsed AST to match printed representation:
- **`FlattenParens`**: Removes unnecessary parentheses while preserving or discarding attributes
- **`AsIfPrinted`**: Normalizes syntax trees by removing redundant tokens (empty generics, shebangs, etc.)

## Public API Surface

### Main Entry Points
- **`SpanlessEq::eq()`**: Primary comparison method for all AST equality testing
- **`librustc_expr()` / `syn_expr()`**: Parser comparison functions for expression validation
- **`FlattenParens::discard_attrs()` / `combine_attrs()`**: Parentheses normalization constructors
- **`AsIfPrinted`**: AST normalization visitor for print consistency testing

## Internal Organization and Data Flow

1. **Parse Phase**: `parse.rs` functions create AST from source strings using both parsers
2. **Normalization Phase**: `visit.rs` visitors transform ASTs to canonical form
3. **Comparison Phase**: `eq.rs` SpanlessEq implementations perform semantic equality checks

The components work together in test scenarios where:
- Source code is parsed by both syn and rustc (`parse.rs`)
- Resulting ASTs are normalized to remove printing artifacts (`visit.rs`) 
- Final comparison uses span-agnostic equality (`eq.rs`)

## Important Patterns and Conventions

### Macro-Driven Code Generation
- `spanless_eq_struct!` and `spanless_eq_enum!` generate implementations for complex AST types
- Field inclusion/exclusion syntax allows fine-grained control over comparison behavior
- Systematic coverage of entire rustc AST ensures comprehensive testing

### Error Resilience
- Panic catching in rustc parser prevents test suite crashes
- Option return types provide graceful failure handling
- Error reporting through `errorf!` macro maintains consistent test output

### Memory Safety
- Extensive use of `mem::take()` and `mem::replace()` for safe AST mutation
- In-place transformation patterns minimize allocation overhead
- Recursive token stream processing handles nested structures safely

This module serves as the foundation for syn's testing strategy, ensuring parser correctness through systematic comparison with the official Rust compiler and maintaining consistency between parsing and pretty-printing operations.
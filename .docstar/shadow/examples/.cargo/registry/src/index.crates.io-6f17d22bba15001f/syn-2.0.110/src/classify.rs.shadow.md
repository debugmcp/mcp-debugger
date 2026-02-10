# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/classify.rs
@source-hash: 3c796df4c891034a
@generated: 2026-02-09T18:11:53Z

## Purpose
Classification utilities for analyzing Rust AST nodes, primarily determining syntactic requirements and token patterns for code formatting and parsing decisions in the `syn` crate.

## Key Functions

### Statement/Expression Classification
- `requires_semi_to_be_stmt(expr: &Expr)` (L17-22): Determines if an expression requires a semicolon to be a valid statement. Special handling for macro expressions with non-brace delimiters.
- `requires_comma_to_be_match_arm(expr: &Expr)` (L25-68): Determines if an expression requires a comma when used as a match arm. Block-like expressions (if, match, while, etc.) return false; all others return true.

### Type Analysis
- `trailing_unparameterized_path(ty: &Type)` (L71-126): Recursively traverses type structures to determine if the trailing component is an unparameterized path. Uses `ControlFlow` to manage complex nested type traversals.
  - Helper `last_type_in_path(path: &Path)` (L105-114): Analyzes path arguments to determine parameterization
  - Helper `last_type_in_bounds(bounds)` (L116-126): Processes type parameter bounds

### Expression Token Analysis  
- `expr_leading_label(expr: &Expr)` (L130-180): Determines if an expression's first token is a loop/block label by recursively traversing expression chains.
- `expr_trailing_brace(expr: &Expr)` (L184-311): Determines if an expression's last token is a closing brace `}`. Complex recursive analysis with multiple helper functions:
  - `type_trailing_brace(ty: &Type)` (L244-277): Analyzes types for trailing braces
  - `last_type_in_path(path: &Path)` (L279-287): Extracts return types from path arguments
  - `last_type_in_bounds(bounds)` (L289-302): Processes bounds for brace analysis
  - `tokens_trailing_brace(tokens: &TokenStream)` (L304-310): Checks raw token streams

## Dependencies
- `crate::expr::Expr`: Expression AST nodes
- `crate::ty::{ReturnType, Type}`: Type system representations
- `crate::path::{Path, PathArguments}`: Path and generic argument structures
- `proc_macro2::{Delimiter, TokenStream, TokenTree}`: Token-level analysis
- `std::ops::ControlFlow`: Flow control for recursive traversals

## Feature Gates
All functionality is gated behind `feature = "full"` and/or `feature = "printing"`, indicating these are specialized utilities for code generation and formatting rather than basic parsing.

## Architecture Notes
- Heavy use of exhaustive pattern matching ensures all AST variants are handled
- Recursive traversal patterns with loop-based implementations for tail recursion optimization
- `ControlFlow` enum used for clean early returns in nested type analysis
- Helper functions are nested within their primary functions to maintain encapsulation
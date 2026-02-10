# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/test_asyncness.rs
@source-hash: 971d560d927d5a84
@generated: 2026-02-09T18:11:57Z

Test file for syn crate's parsing of async constructs, specifically validating that the parser correctly identifies and structures async functions and closures.

**Primary Purpose**: Unit tests for async keyword parsing in Rust syntax elements using snapshot testing to verify AST structure.

**Key Tests**:
- `test_async_fn` (L14-32): Tests parsing of async function declarations, verifying the `asyncness` field is correctly set to `Some` in the parsed `Signature` struct
- `test_async_closure` (L34-49): Tests parsing of async closure expressions, ensuring the `asyncness` field is properly captured in the `Expr::Closure` variant

**Dependencies**:
- `syn` crate types: `Expr`, `Item` (L12) - Core AST node types for expressions and top-level items
- Local modules: `snapshot` (L8), `debug` (L10) - Testing utilities for snapshot comparison

**Testing Pattern**: Uses snapshot testing via the `snapshot!` macro to compare parsed AST structure against expected serialized format. This ensures parsing behavior remains consistent across code changes.

**AST Validation Focus**:
- Async function signatures capture `asyncness: Some` in the `Signature` struct
- Async closures capture `asyncness: Some` in the `Expr::Closure` variant
- Both test cases use empty function bodies/blocks to isolate async keyword parsing from body parsing logic

**Architectural Note**: Part of syn crate's comprehensive test suite ensuring async/await syntax parsing correctness, critical for tools that need to understand modern Rust async constructs.
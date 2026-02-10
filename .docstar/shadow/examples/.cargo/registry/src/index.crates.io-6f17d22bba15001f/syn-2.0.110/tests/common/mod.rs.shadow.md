# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/common/mod.rs
@source-hash: b752aa8f1faf8c6a
@generated: 2026-02-09T18:06:22Z

**Purpose**: Test utility module providing common functionality for the `syn` crate's test suite.

**Structure**: 
- Module declaration file that exposes three public submodules for testing infrastructure
- `eq` module (L4) - likely contains equality testing utilities for AST comparison
- `parse` module (L5) - probably provides parsing test helpers and fixtures  
- `visit` module (L6) - presumably contains visitor pattern test utilities for AST traversal

**Configuration**:
- Allows dead code (L1) since test utilities may not all be actively used
- Suppresses clippy warnings for module name repetitions and shadow unrelated (L2)

**Usage Context**: 
This is a standard Rust module organization pattern for test common code, making shared test utilities available across the syn crate's test suite. The three exposed modules likely correspond to major testing categories for a syntax parsing library: equality checking, parsing operations, and AST visiting/transformation.
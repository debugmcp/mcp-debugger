# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/test_size.rs
@source-hash: 03efaf829b80b7db
@generated: 2026-02-09T18:12:02Z

## Purpose
Memory size validation test suite for core syn AST types, ensuring stable memory layout across Rust compiler versions on 64-bit platforms.

## Key Functions
- `test_expr_size()` (L12-14): Validates `Expr` enum size is 176 bytes
- `test_item_size()` (L22-24): Validates `Item` enum size is 352 bytes  
- `test_type_size()` (L32-34): Validates `Type` enum size is 224 bytes
- `test_pat_size()` (L42-44): Validates `Pat` enum size is 184 bytes
- `test_lit_size()` (L52-54): Validates `Lit` enum size is 24 bytes

## Dependencies
- `std::mem` for `size_of` introspection
- `syn` crate types: `Expr`, `Item`, `Lit`, `Pat`, `Type`
- `rustversion` for conditional compilation based on Rust version

## Architectural Decisions
- **Platform-specific**: Tests only run on 64-bit targets via `cfg_attr` guards
- **Version-gated**: Each test requires specific minimum nightly Rust versions (ranging from 2022-09-09 to 2023-12-20)
- **Memory layout stability**: Hardcoded size assertions ensure AST node memory footprint doesn't regress

## Critical Constraints
- Assumes proc-macro2's "span-locations" feature is disabled (L1 comment)
- Tests will be ignored on non-64-bit architectures
- Tests will be ignored on Rust versions before their respective minimum requirements
- Memory sizes are architecture and compiler-version dependent
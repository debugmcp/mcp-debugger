# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/benches/file.rs
@source-hash: 6f2ae7748d1576cf
@generated: 2026-02-09T18:11:49Z

## Purpose
Benchmark suite for measuring syn parser performance on Rust source files. Tests parsing overhead by benchmarking token cloning, token buffer creation, and full file parsing against a large real-world Rust source file.

## Key Components

### Constants
- `FILE` (L32): Path to benchmark target file (`tests/rust/library/core/src/str/mod.rs`) from Rust's standard library

### Core Functions
- `get_tokens()` (L34-38): Retrieves tokenized content by cloning rust repository and reading/parsing the target file into a `TokenStream`

### Benchmark Functions
- `baseline()` (L40-44): Measures baseline cost of cloning `TokenStream` tokens without any parsing
- `create_token_buffer()` (L46-53): Benchmarks token buffer creation overhead using a parser that immediately fails with empty error
- `parse_file()` (L55-59): Measures full file parsing performance using `syn::parse2::<syn::File>()`

## Dependencies
- **proc_macro2**: Provides `TokenStream` and `Span` for token manipulation
- **syn**: Target parsing library being benchmarked, provides `File` AST node and parsing infrastructure
- **test**: Rust's unstable benchmarking framework (`Bencher` type)
- **macros module** (L18-20): Imported from `../tests/macros/mod.rs` for test utilities
- **repo module** (L22-24): Provides `clone_rust()` function for obtaining benchmark source files

## Architecture
Progressive benchmarking approach: baseline token operations → token buffer creation → full parsing. Each benchmark uses the same source tokens to ensure consistent comparison. The `immediate_fail` parser (L49-51) isolates token buffer creation costs by avoiding actual parsing work.

## Configuration
- Requires `rustc_private` and `test` unstable features
- Recursion limit increased to 1024 for complex parsing scenarios
- Multiple clippy lints disabled for benchmark-specific code patterns
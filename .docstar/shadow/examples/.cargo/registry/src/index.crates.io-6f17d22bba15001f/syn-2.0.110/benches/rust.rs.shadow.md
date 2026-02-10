# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/benches/rust.rs
@source-hash: 53cb8accfda73e59
@generated: 2026-02-09T18:11:57Z

## Primary Purpose
Benchmark suite for the syn crate that compares parsing performance across different Rust parsing implementations. Tests syn's parsing speed against rustc's parser and proc_macro2's tokenization on real Rust code from the compiler and library repositories.

## Architecture & Configuration
- **Conditional compilation**: Uses `syn_only` cfg flag to enable syn-only profiling mode (L6, L32, L51, L109, L164)
- **Module structure**: Imports shared test utilities from `../tests/macros/mod.rs` (L21) and `../tests/repo/mod.rs` (L25)

## Key Benchmark Modules

### `tokenstream_parse` (L33-41)
- **Purpose**: Benchmarks proc_macro2::TokenStream parsing performance
- **Function**: `bench()` - parses string content to TokenStream, discarding result
- **Conditional**: Only available when not in syn_only mode

### `syn_parse` (L43-49) 
- **Purpose**: Benchmarks syn::parse_file parsing performance
- **Function**: `bench()` - parses string content as Rust file using syn
- **Always available**: Core benchmark target

### `librustc_parse` (L52-107)
- **Purpose**: Benchmarks rustc's internal parser performance
- **Key components**:
  - `SilentEmitter` (L74-84): Custom error handler that suppresses diagnostic output
  - `bench()` (L73-106): Sets up rustc parsing session with proper edition detection
- **Dependencies**: Heavy rustc internal crates (L53-59)
- **Conditional**: Only available when not in syn_only mode

### `read_from_disk` (L110-117)
- **Purpose**: Baseline benchmark measuring pure I/O overhead
- **Function**: No-op parser that just measures file reading time

## Core Execution Logic

### `exec()` (L119-148)
- **Purpose**: Orchestrates benchmark execution across Rust source files
- **Process**: 
  1. Walks `tests/rust/compiler` and `tests/rust/library` directories (L124)
  2. Applies `repo::base_dir_filter` to select relevant files (L129)
  3. Executes provided parsing function on each file (L138)
  4. Tracks success/failure rates and timing (L121-122, L139-140)
- **Error handling**: Reports failed files to stderr (L141-143)
- **Validation**: Asserts 100% success rate (L146)

### `main()` (L150-194)
- **Setup**: Clones Rust repository via `repo::clone_rust()` (L151)
- **Macro**: `testcases!` macro (L153-162) generates benchmark suite with conditional compilation
- **Execution flow**:
  1. Optional file/line counting when not in syn_only mode (L164-174)
  2. Runs all available benchmarks with timing (L176-192)
  3. Reports elapsed time in seconds.milliseconds format (L187-191)

## Dependencies & Relationships
- **External**: walkdir for directory traversal, proc_macro2 for tokenization
- **Internal**: Relies on repo module for Rust source management and edition detection
- **Rustc integration**: Deep integration with rustc internals for compiler parsing comparison

## Critical Constraints
- Requires `full` and `test` features for complete functionality
- Rustc parser benchmarks need `rustc_private` feature and are disabled in syn_only mode
- All benchmark functions must have identical signature: `fn(&Path, &str) -> Result<(), ()>`
- Expects 100% parsing success rate across all test files
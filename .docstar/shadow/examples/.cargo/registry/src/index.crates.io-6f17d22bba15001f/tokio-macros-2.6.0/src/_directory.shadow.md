# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-macros-2.6.0/src/
@generated: 2026-02-09T18:16:14Z

## Purpose
This directory contains the core implementation of Tokio's procedural macros, providing runtime setup automation and async code generation for Rust applications. It transforms async functions into properly configured Tokio runtime contexts through attribute macros `#[tokio::main]` and `#[tokio::test]`, and provides implementation utilities for the `select!` macro.

## Key Components and Relationships

**lib.rs** - Main crate entry point that exposes public procedural macros and delegates to implementation modules:
- `main`/`main_rt` - Async main function decoration
- `test`/`test_rt` - Async test function decoration  
- Fallback error macros when runtime features are missing
- Hidden `select!` implementation helpers

**entry.rs** - Core macro implementation engine containing:
- Configuration parsing and validation logic
- Runtime setup code generation
- Custom AST parsing for function transformation
- Migration support and error handling

**select.rs** - Specialized utilities for `select!` macro support:
- Output enum generation for select branches
- Pattern sanitization (removing `ref`/`mut` modifiers)
- Branch counting and bitmask optimization

## Public API Surface

### Primary Entry Points
- `#[tokio::main]` - Decorates async main functions with multi-threaded runtime
- `#[tokio::test]` - Decorates async test functions with current-thread runtime
- Alternative `_rt` variants for different runtime configurations

### Configuration Options
Both main and test macros support extensive attribute configuration:
- Runtime flavors: `multi_thread`, `current_thread`, `local` (unstable)
- Worker thread count: `worker_threads = N`
- Test utilities: `start_paused = true`
- Custom crate paths: `crate = "..."`
- Panic handling: `unhandled_panic = "shutdown_runtime"` (unstable)

### Hidden Implementation Helpers
- `select_priv_declare_output_enum` - Generates select branch enums
- `select_priv_clean_pattern` - Sanitizes patterns for select matching

## Internal Organization and Data Flow

1. **Macro Invocation**: User applies `#[tokio::main]` or `#[tokio::test]` to async function
2. **Delegation**: lib.rs routes to appropriate entry.rs function (`main()` or `test()`)
3. **Parsing**: entry.rs parses function signature and macro attributes using custom AST types
4. **Validation**: Configuration builder validates attribute combinations and feature availability
5. **Code Generation**: Runtime builder chain generated based on configuration
6. **Transformation**: Original async function wrapped in runtime execution context
7. **Output**: Generated synchronous function with embedded async runtime setup

For select macros, select.rs provides:
- Branch enumeration and mask type selection based on branch count
- Pattern preprocessing to ensure compatibility with select internals

## Important Patterns and Conventions

**Graceful Degradation**: All macros generate valid code even on configuration errors to maintain IDE functionality and provide clear compile-time feedback.

**Feature Flag Integration**: Conditional compilation based on Tokio feature availability (`rt-multi-thread`, unstable features) with helpful error messages when features are missing.

**Span Preservation**: Maintains original source location information throughout transformation for accurate error reporting and debugging.

**Custom AST Types**: Uses specialized parsing for function items to preserve attribute positioning and handle token stream manipulation precisely.

**Migration Support**: Provides clear upgrade paths for deprecated attribute names and configurations.

## Dependencies
- `proc_macro`/`proc_macro2`: Core procedural macro infrastructure
- `syn`: Rust syntax parsing with custom Parse implementations
- `quote`: Code generation and token stream manipulation

This module serves as the primary interface between user code and Tokio's runtime system, automating the boilerplate required for async function execution in both application and testing contexts.
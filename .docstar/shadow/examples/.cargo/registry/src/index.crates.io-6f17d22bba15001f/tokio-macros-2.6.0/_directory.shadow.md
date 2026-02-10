# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-macros-2.6.0/
@generated: 2026-02-09T18:16:32Z

## Purpose
The `tokio-macros` crate provides essential procedural macros that automate Tokio runtime setup and configuration for async Rust applications. It bridges the gap between user-written async code and Tokio's runtime system by transforming async functions into properly configured runtime contexts through attribute macros.

## Key Components and Relationships
The crate is organized around a clean separation of concerns:

- **lib.rs** serves as the public API facade, exposing the main procedural macros (`#[tokio::main]`, `#[tokio::test]`) and routing macro invocations to their implementations
- **entry.rs** contains the core transformation engine that handles configuration parsing, validation, and code generation for runtime setup 
- **select.rs** provides specialized utilities supporting the `select!` macro implementation with pattern processing and enum generation

The components work together in a pipeline: lib.rs delegates macro calls to entry.rs, which parses configurations and generates runtime setup code, while select.rs provides orthogonal support for select macro internals.

## Public API Surface

### Primary Macros
- `#[tokio::main]` - Transforms async main functions into synchronous entry points with multi-threaded runtime
- `#[tokio::test]` - Wraps async test functions with current-thread runtime for testing
- Alternative `_rt` variants for different runtime configurations

### Configuration Options
Both macros support comprehensive runtime configuration:
- **Runtime flavors**: `multi_thread`, `current_thread`, `local` (unstable)
- **Performance tuning**: `worker_threads = N` for thread pool sizing
- **Testing utilities**: `start_paused = true` for time-based tests
- **Integration options**: `crate = "..."` for custom Tokio imports
- **Error handling**: `unhandled_panic = "shutdown_runtime"` (unstable)

### Internal Helpers
- Hidden `select!` macro implementation utilities for enum generation and pattern sanitization

## Internal Organization and Data Flow
The macro transformation follows a structured pipeline:

1. **Invocation**: User applies macro attribute to async function
2. **Routing**: lib.rs delegates to appropriate entry.rs handler
3. **Parsing**: Custom AST parsing extracts function signature and configuration attributes
4. **Validation**: Configuration builder validates attribute combinations and feature availability
5. **Generation**: Runtime builder chain constructed based on parsed configuration
6. **Transformation**: Original async function wrapped in runtime execution context
7. **Output**: Synchronous function with embedded runtime setup

## Important Patterns and Conventions

**Graceful Error Handling**: All macros generate valid code even on configuration errors, ensuring IDE functionality while providing clear compile-time feedback.

**Feature-Aware Compilation**: Conditional code generation based on available Tokio features (`rt-multi-thread`, unstable features) with helpful error messages for missing features.

**Span Preservation**: Maintains original source locations throughout transformation for accurate error reporting and debugging support.

**Migration Support**: Provides clear upgrade paths for deprecated configurations and helpful error messages for common migration scenarios.

## Dependencies and Integration
Built on standard procedural macro infrastructure (`proc_macro2`, `syn`, `quote`) with custom Parse implementations for precise token stream manipulation. The crate serves as the primary interface between user code and Tokio's runtime system, eliminating the need for manual runtime setup boilerplate in both application and testing contexts.
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-macros-2.6.0/src/entry.rs
@source-hash: 47848ed5974630e1
@generated: 2026-02-09T18:12:46Z

## Purpose
Core implementation for `tokio::main` and `tokio::test` procedural macros. Parses macro attributes, validates configurations, and generates runtime setup code for async functions.

## Key Types and Configuration

**RuntimeFlavor (L9-28)**: Enum defining Tokio runtime types
- `CurrentThread`: Single-threaded runtime
- `Threaded`: Multi-threaded runtime  
- `Local`: Unstable local runtime flavor
- `from_str()` method provides string-to-enum conversion with helpful error messages for deprecated names

**UnhandledPanic (L30-53)**: Enum for panic handling behavior
- `Ignore`: Continue runtime on panic
- `ShutdownRuntime`: Shutdown runtime on panic
- `into_tokens()` generates corresponding Tokio runtime enum tokens

**Configuration (L72-237)**: Mutable builder for macro attribute parsing
- Tracks runtime multi-threading availability and default flavor
- Setter methods (`set_flavor`, `set_worker_threads`, etc.) prevent duplicate attributes
- `build()` method validates attribute combinations and returns `FinalConfig`

**FinalConfig (L55-61)**: Immutable validated configuration for code generation

## Core Functions

**build_config() (L296-390)**: Main attribute parsing logic
- Validates function has `async` keyword
- Processes name-value pairs (`flavor = "multi_thread"`) and standalone identifiers
- Provides migration guidance for deprecated attribute names
- Returns validation errors for invalid combinations

**parse_knobs() (L392-517)**: Code generation engine
- Removes `async` from function signature
- Generates runtime builder chain based on configuration
- Creates conditional compilation blocks for unstable features
- Wraps function body in async block and runtime execution

**Parsing utilities (L239-294)**: Type-safe literal value extractors
- `parse_int()`, `parse_string()`, `parse_path()`, `parse_bool()`
- Consistent error messaging with field context

## Entry Points

**main() (L524-546)**: `#[tokio::main]` macro implementation
- Validates main function has no parameters
- Uses `rt_multi_thread` feature flag for runtime selection
- Falls back to error configuration on validation failure

**test() (L577-598)**: `#[tokio::test]` macro implementation  
- Checks for conflicting `#[test]` attributes
- Always uses current-thread runtime for tests
- Generates `#[::core::prelude::v1::test]` attribute

## Custom AST Types

**ItemFn (L600-707)**: Custom function item parser
- Separates outer/inner attributes for proper token generation
- Parses function body as token streams rather than full AST
- `into_tokens()` method reconstructs function with generated code

**Body (L709-723)**: Wrapper for function body token streams

## Architecture Patterns

- **Fallback strategy**: Always generates valid code even on configuration errors to maintain IDE functionality
- **Span preservation**: Maintains source location information for error reporting
- **Feature flag integration**: Conditional compilation for unstable/optional Tokio features
- **Migration support**: Provides clear error messages for deprecated attribute names

## Dependencies
- `proc_macro2`: Token stream manipulation
- `syn`: Rust syntax parsing with custom `Parse` implementations  
- `quote`: Code generation macros
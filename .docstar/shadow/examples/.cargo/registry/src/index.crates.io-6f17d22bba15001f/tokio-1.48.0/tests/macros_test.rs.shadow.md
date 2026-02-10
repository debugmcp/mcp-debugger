# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/macros_test.rs
@source-hash: f9c0b7ad516a4a41
@generated: 2026-02-09T18:12:23Z

## Purpose
Test file for Tokio's procedural macros (`#[tokio::test]` and `#[tokio::main]`), validating their behavior across various edge cases and compiler scenarios.

## Key Test Functions

### Basic Macro Usage
- `test_macro_can_be_used_via_use()` (L6-8): Tests `#[test]` macro imported via `use tokio::test`
- `test_macro_is_resilient_to_shadowing()` (L11-13): Tests `#[tokio::test]` macro with fully qualified path

### Issue Regression Tests
- **GitHub Issue #3403** (L15-21): Tests unused braces warning compatibility
  - `unused_braces_main()` (L18): `#[tokio::main]` with single statement
  - `unused_braces_test()` (L21): `#[tokio::test]` with single statement
- **GitHub Issue #3766** (L24-40): Tests macro usage within trait implementations
  - `trait_method()` (L25-40): Defines trait A with async method using `#[tokio::main]`
- **GitHub Issue #4175** (L42-56): Tests various return types
  - `issue_4175_main_1()` (L44-46): Never type return (`!`)
  - `issue_4175_main_2()` (L48-50): Result type return
  - `issue_4175_test()` (L53-56): Test with early return and unreachable panic
- **GitHub Issue #4175 (Clippy)** (L58-79): Module `clippy_semicolon_if_nothing_returned` testing Clippy lint compatibility
- **GitHub Issue #5243** (L82-94): Module `issue_5243` testing macro usage within macro_rules definitions

### Unstable Features (L96-117)
Module `macro_rt_arg_unhandled_panic` (conditional on `tokio_unstable` feature):
- `unhandled_panic_shutdown_runtime()` (L102-107): Tests `unhandled_panic = "shutdown_runtime"` parameter
- `unhandled_panic_ignore()` (L110-116): Tests `unhandled_panic = "ignore"` parameter

## Dependencies
- `tokio::test` (L3)
- `tokio_test::assert_err` (L98, conditional)

## Configuration
- Requires "full" feature and excludes WASI target (L1)
- Some functionality gated behind `tokio_unstable` feature (L96)

## Architectural Notes
- Uses `rustfmt::skip` attributes to preserve specific formatting for compiler warning tests
- Includes `should_panic` and `allow` attributes for specific test behaviors
- Tests both qualified (`#[tokio::test]`) and imported (`#[test]`) macro usage patterns
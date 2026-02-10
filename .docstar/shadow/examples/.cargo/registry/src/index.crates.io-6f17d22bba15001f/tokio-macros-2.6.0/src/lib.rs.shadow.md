# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-macros-2.6.0/src/lib.rs
@source-hash: b901e344d927f1c6
@generated: 2026-02-09T18:12:36Z

## Purpose
Tokio macros crate providing procedural macros for async function decoration and runtime setup. Entry point for `#[tokio::main]`, `#[tokio::test]`, and `select!` macro implementation.

## Module Structure
- **entry module (L20)**: Contains implementation logic for `main` and `test` macros
- **select module (L21)**: Contains implementation for `select!` macro support functions

## Key Macros

### Primary Runtime Macros
- **`main` (L305-308)**: Main attribute macro for decorating async main functions with Tokio runtime setup. Delegates to `entry::main` with `is_test=true`
- **`main_rt` (L369-372)**: Alternative main macro variant, delegates to `entry::main` with `is_test=false`
- **`test` (L573-576)**: Test attribute macro for async test functions. Delegates to `entry::test` with `is_test=true`
- **`test_rt` (L588-591)**: Alternative test macro variant, delegates to `entry::test` with `is_test=false`

### Fallback Macros
- **`main_fail` (L597-605)**: Compile-time error macro when runtime features are missing
- **`test_fail` (L611-619)**: Compile-time error macro when runtime features are missing for tests

### Select Implementation Helpers
- **`select_priv_declare_output_enum` (L624-627)**: Hidden implementation detail for `select!` macro enum generation
- **`select_priv_clean_pattern` (L632-635)**: Hidden implementation detail for `select!` macro pattern cleaning

## Configuration Options
The main/test macros support extensive configuration:
- Runtime flavors: `multi_thread`, `current_thread`, `local` (unstable)
- Worker thread count configuration
- Time pausing for testing (`start_paused`)
- Custom crate naming (`crate` parameter)
- Unhandled panic behavior (unstable feature)

## Dependencies
- **proc_macro**: Standard procedural macro support (L18, L23)
- **syn, proc_macro2**: Implied dependencies for error handling (L599, L614)

## Architecture Notes
- All macro implementations delegate to functions in `entry` and `select` modules
- Extensive documentation with equivalent non-macro code examples
- Conditional compilation support for unstable features
- Error macros provide clear guidance when required runtime features are missing
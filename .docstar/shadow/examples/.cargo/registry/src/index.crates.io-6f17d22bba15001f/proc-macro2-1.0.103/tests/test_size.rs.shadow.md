# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/tests/test_size.rs
@source-hash: 62d8373ea46b669b
@generated: 2026-02-09T18:11:46Z

## Primary Purpose
Test suite that validates memory layout sizes of proc-macro types across different compilation configurations. Ensures consistency and detects memory footprint regressions for both standard `proc_macro` types and `proc_macro2` fallback/wrapper implementations.

## Key Test Functions
- **`test_proc_macro_size` (L10-19)**: Validates standard library `proc_macro` type sizes on 64-bit systems with Rust 1.64+
- **`test_proc_macro2_fallback_size_without_locations` (L25-34)**: Tests `proc_macro2` fallback implementation sizes when span location tracking is disabled
- **`test_proc_macro2_fallback_size_with_locations` (L40-49)**: Tests `proc_macro2` fallback implementation sizes when span location tracking is enabled  
- **`test_proc_macro2_wrapper_size_without_locations` (L56-65)**: Tests `proc_macro2` wrapper mode sizes without location tracking (Rust 1.71+)
- **`test_proc_macro2_wrapper_size_with_locations` (L72-81)**: Tests `proc_macro2` wrapper mode sizes with location tracking (Rust 1.65+)

## Dependencies and Architecture
- **External crates**: `proc_macro` (L3), `rustversion` for Rust version-gated tests
- **Core dependency**: `std::mem` (L5) for `size_of` introspection
- **Conditional compilation**: Extensive use of `cfg_attr` for platform-specific (64-bit only) and feature-flag testing

## Test Configuration Matrix
Tests validate 4 distinct configuration combinations:
1. **Standard proc_macro**: Direct stdlib types
2. **Fallback mode**: Pure Rust implementation without compiler integration
3. **Wrapper mode**: Thin wrapper around stdlib proc_macro  
4. **Location tracking**: Feature flag affecting span storage requirements

## Memory Layout Expectations
- **Span sizes**: Range from 0 bytes (fallback, no locations) to 12 bytes (wrapper with locations)
- **TokenStream sizes**: Vary significantly between fallback (8 bytes) and wrapper (32 bytes) modes
- **Type hierarchy**: Group, Ident, Literal are largest types (16-32 bytes), Punct is mid-range (8-20 bytes)

## Critical Invariants
- All tests restricted to 64-bit platforms only (L8, L21, L36, L52, L68)
- Layout randomization disables tests to ensure deterministic results
- Version gates prevent running on incompatible Rust versions
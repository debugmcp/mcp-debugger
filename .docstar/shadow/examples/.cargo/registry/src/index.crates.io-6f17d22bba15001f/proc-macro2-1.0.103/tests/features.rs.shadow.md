# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/tests/features.rs
@source-hash: 7e52c0c801019b27
@generated: 2026-02-09T18:11:38Z

## Purpose and Responsibility
Test file for verifying proc-macro2 feature configuration during test execution. Ensures the library correctly compiles without the "proc-macro" feature flag.

## Key Functions
- `make_sure_no_proc_macro()` (L5-10): Ignored test that asserts the "proc-macro" feature is disabled during compilation. Uses `cfg!` macro to check compile-time feature flags and panics with descriptive message if the feature is unexpectedly enabled.

## Dependencies
- Standard Rust test framework (`#[test]`)
- Clippy lint suppressions for assertion patterns and ignore attributes

## Architectural Decisions
- Test is marked with `#[ignore]` (L4), meaning it runs only when explicitly requested with `cargo test -- --ignored`
- Uses compile-time feature detection via `cfg!` macro rather than runtime checks
- Defensive assertion with custom error message to aid debugging feature configuration issues

## Critical Invariants
- The "proc-macro" feature must be disabled when this test runs
- Test serves as a build-time sanity check for feature flag configuration in proc-macro2 crate
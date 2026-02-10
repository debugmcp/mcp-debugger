# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/compiletest.rs
@source-hash: 48cfd92c7271345d
@generated: 2026-02-09T18:11:37Z

This is a compile-time test runner for the pin-project-lite crate that validates macro behavior through UI tests.

## Primary Purpose
Executes compile-time tests using the `trybuild` framework to ensure pin-project macros produce correct compilation results and error messages. Only runs on nightly Rust compiler builds.

## Key Functions
- `ui()` (L7-11): Main test function that orchestrates compilation tests
  - Uses `trybuild::TestCases` to run two test suites
  - Tests negative cases via `compile_fail()` for files in `tests/ui/**/*.rs`
  - Tests positive cases via `pass()` for files in `tests/run-pass/**/*.rs`

## Configuration Attributes
- `#![cfg(not(miri))]` (L3): Excludes entire file from Miri interpreter runs
- `#[rustversion::attr(not(nightly), ignore)]` (L5): Skips test on stable/beta Rust versions

## Dependencies
- `trybuild`: Compile-time testing framework for proc macros
- `rustversion`: Conditional compilation based on Rust version

## Architectural Pattern
Follows standard Rust proc-macro testing pattern where:
- UI tests verify exact compiler output (errors, warnings)
- Compile-fail tests ensure invalid usage produces expected errors
- Pass tests verify valid usage compiles successfully

This is a critical component for ensuring pin-project-lite's proc macros maintain correct behavior across compiler versions.
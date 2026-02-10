# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/cfg-if-1.0.4/tests/xcrate.rs
@source-hash: bcec148e69db81b1
@generated: 2026-02-09T18:11:25Z

## Purpose
Cross-crate test file for the `cfg-if` crate, demonstrating conditional compilation behavior in a testing context.

## Key Components
- **cfg_if macro usage (L3-11)**: Demonstrates conditional function definition based on compilation flags
  - `#[cfg(foo)]` branch (L4-5): Returns `false` for non-existent config flag
  - `#[cfg(test)]` branch (L6-7): Returns `true` when compiled for testing
  - Default fallback (L8-9): Returns `false` for all other cases
- **works() function**: Conditionally defined function that returns different boolean values based on compilation context
- **smoke test (L13-16)**: Unit test verifying that `works()` returns `true` in test compilation mode

## Architectural Decisions
- Uses `#![allow(unexpected_cfgs)]` (L1) to suppress warnings about the non-existent `foo` configuration flag
- Leverages `cfg-if!` macro to create clean conditional compilation logic without repetitive `#[cfg]` attributes
- Tests the macro's ability to handle multiple conditional branches with fallback behavior

## Critical Behavior
The file validates that `cfg-if!` correctly selects the `#[cfg(test)]` branch during test compilation, ensuring `works()` returns `true` and the assertion passes. This demonstrates the macro's core functionality of conditional code selection based on compilation context.
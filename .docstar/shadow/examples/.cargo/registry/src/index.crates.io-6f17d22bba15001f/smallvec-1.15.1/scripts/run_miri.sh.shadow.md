# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/smallvec-1.15.1/scripts/run_miri.sh
@source-hash: 74a9f9adc43f986e
@generated: 2026-02-09T18:11:47Z

## Purpose
Shell script for running Miri (Rust's mid-level IR interpreter) tests on the smallvec crate. Automates the process of installing the latest nightly Rust toolchain with working Miri support and executing comprehensive test suites.

## Key Operations

### Environment Setup (L1-7)
- Sets strict error handling with `set -ex` (L3) - exits on any command failure and prints executed commands
- Performs clean build by removing artifacts (L7) to avoid toolchain version conflicts

### Miri Installation (L9-18)
- Dynamically determines latest working Miri nightly version (L12) by querying rust-lang component history
- Resets any existing toolchain overrides (L14) and sets system default to Miri-compatible nightly (L15)
- Installs Miri component and performs setup (L17-18)

### Test Execution (L20-22)
- Runs three test configurations with verbose output:
  - Base tests (L20)
  - Tests with `union` feature enabled (L21) 
  - Tests with all features enabled (L22)

### Cleanup (L24)
- Restores nightly toolchain override for development environment

## Dependencies
- External: `curl` for HTTP requests, `rustup` for Rust toolchain management, `cargo` for build operations
- Network dependency on rust-lang.github.io for component availability data

## Architectural Notes
- Follows CI best practices by using latest known-good Miri build rather than absolute latest nightly
- Comprehensive feature testing ensures smallvec works correctly across different configuration combinations
- Script is self-contained and handles its own environment management
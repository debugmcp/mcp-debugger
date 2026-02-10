# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/ci/test-stable.sh
@source-hash: fb751f06f314f728
@generated: 2026-02-09T18:11:23Z

## Purpose
CI test script for the bytes crate that runs comprehensive testing across different feature combinations and Rust versions, with special nightly-only checks for benchmarks and minimal version compatibility.

## Key Components

**Main Test Flow (L5-12)**
- `cmd` variable (L5): Defaults to "test" but accepts command override via first argument
- Feature matrix testing (L10): Uses `cargo hack` to test all feature combinations with `--each-feature --optional-deps`
- Full feature testing (L12): Runs command with `--all-features` flag

**Nightly-Specific Checks (L14-25)**
- Rust version detection (L14): Checks if `RUST_VERSION` environment variable starts with "nightly"
- Benchmark validation (L16): Runs `cargo check --benches` for nightly builds
- Minimal version testing (L18-24): Complex workflow to validate minimal dependency versions:
  - Removes dev-dependencies from workspace (L21)
  - Updates Cargo.lock with minimal versions using `-Z minimal-versions` flag (L23)
  - Validates build with minimal versions (L24)

## Dependencies
- `cargo hack`: External tool for feature combination testing
- `cargo`: Standard Rust toolchain
- Environment variable `RUST_VERSION` for nightly detection

## Execution Pattern
- Uses `set -ex` (L3) for strict error handling and command echoing
- Conditional execution based on Rust version detection
- Sequential test phases: feature matrix → full features → nightly-only checks
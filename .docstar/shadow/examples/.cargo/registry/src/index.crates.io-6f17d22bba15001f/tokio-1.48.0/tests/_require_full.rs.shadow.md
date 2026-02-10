# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/_require_full.rs
@source-hash: 1f58c8125018bd88
@generated: 2026-02-09T18:12:03Z

## Primary Purpose
Test configuration validation file that enforces proper feature flags during Tokio test execution. Acts as a compile-time guard to prevent silent test failures due to missing or conflicting feature configurations.

## Key Components

### Compile-time Checks
- **Full feature requirement (L1-2)**: Enforces that Tokio tests run with either `--features full` or on WASM targets. Prevents incomplete test coverage by failing compilation when essential features are missing.
- **Parking lot conflict detection (L7-8)**: Validates CI configuration by detecting when `parking_lot` feature is accidentally enabled during tests that should run without it (controlled by `tokio_no_parking_lot` cfg).

## Architectural Purpose
- **Test Infrastructure**: Part of Tokio's test harness ensuring consistent test execution environments
- **CI/CD Integration**: Specifically designed to catch configuration errors in automated testing pipelines
- **Feature Flag Validation**: Prevents subtle bugs where tests pass with incomplete feature sets, masking real issues

## Critical Constraints
- Must be included early in test execution to catch configuration issues before any actual test code runs
- Relies on Rust's compile-time error mechanism to halt execution with misconfigured builds
- Specifically targets the interaction between `tokio_no_parking_lot` cfg and `parking_lot` feature flag
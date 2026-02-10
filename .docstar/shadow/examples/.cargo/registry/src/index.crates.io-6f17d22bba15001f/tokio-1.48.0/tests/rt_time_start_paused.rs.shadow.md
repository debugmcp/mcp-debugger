# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/rt_time_start_paused.rs
@source-hash: 7f19f066e32815d5
@generated: 2026-02-09T18:12:23Z

**Primary Purpose**: Test file verifying that Tokio's `start_paused = true` test attribute properly freezes time during async test execution.

**Core Functionality**:
- `test_start_paused()` (L5-14): Async test function that validates time-pausing behavior
  - Uses `#[tokio::test(start_paused = true)]` attribute to enable paused time mode
  - Captures initial timestamp with `Instant::now()` (L7)
  - Executes 5 iterations of `std::thread::sleep(Duration::from_millis(1))` (L10-13)
  - Asserts that `Instant::now()` remains unchanged after each sleep (L12)

**Key Dependencies**:
- `tokio::time::{Duration, Instant}` (L3): Time utilities for duration and instant measurements
- Requires `feature = "full"` (L1): Full Tokio feature set needed for test infrastructure

**Testing Pattern**: 
- Demonstrates time-mocking capability where standard library sleep operations don't advance Tokio's internal clock
- Validates that paused time mode isolates async time operations from system time progression
- Uses standard library sleep (not Tokio's async sleep) to verify that only Tokio time is frozen

**Architectural Context**:
This is a unit test specifically for Tokio's runtime testing infrastructure, ensuring that the `start_paused` attribute correctly implements deterministic time behavior for async tests.
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/test_clock.rs
@source-hash: d5c9bf7bb5d926e2
@generated: 2026-02-09T18:12:32Z

## Purpose
Test suite for Tokio's time manipulation functionality, specifically testing the clock control mechanisms for pausing, advancing, and resuming time in async contexts.

## Key Test Functions

**`resume_lets_time_move_forward_instead_of_resetting_it` (L6-17)**
- Tests that `time::resume()` allows time to continue from where it was paused, not reset to system time
- Verifies time advancement behavior: pauses time, advances by 10 seconds, then resumes
- Asserts that resumed time continues from the advanced position with minimal drift

**`can_pause_after_resume` (L19-29)**
- Tests the ability to pause time again after resuming
- Validates cumulative time advancement across pause/resume cycles
- Ensures total advancement exceeds 20 seconds but remains under 21 seconds

**`freezing_time_while_frozen_panics` (L31-36)**
- Negative test ensuring double-pause operations panic
- Uses `#[should_panic]` to verify error handling

**`advancing_time_when_time_is_not_frozen_panics` (L38-42)**
- Negative test ensuring `time::advance()` panics when time is not paused
- Validates that time manipulation requires explicit pause state

**`resuming_time_when_not_frozen_panics` (L44-50)**
- Negative test ensuring double-resume operations panic
- Tests state machine integrity of time control

## Dependencies
- `tokio::time` module: `Duration`, `Instant`, `pause()`, `advance()`, `resume()`
- Tokio test framework with `#[tokio::test]` attribute

## Architectural Patterns
- State-based testing of time control APIs
- Boundary condition testing with panic expectations
- Precision timing assertions with tolerance ranges (±1 second buffers)

## Critical Invariants
- Time can only be paused once before requiring resume
- Time advancement only works when paused
- Resume can only be called when time is paused
- Time progression maintains monotonic ordering
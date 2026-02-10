# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/time_sleep.rs
@source-hash: c23f9d843190006c
@generated: 2026-02-09T18:12:44Z

## Purpose
Test suite for Tokio's `time::sleep` functionality, covering sleep timers, deadline-based sleeping, and time manipulation using paused time in test environments.

## Key Test Functions

### Basic Sleep Tests
- `immediate_sleep()` (L13-22): Tests sleep with immediate deadline (now)
- `is_elapsed()` (L24-41): Verifies `is_elapsed()` method behavior before/after sleep completion
- `delayed_sleep_level_0()` (L43-55): Tests various sleep durations (1ms, 10ms, 60ms)
- `sub_ms_delayed_sleep()` (L57-69): Tests sub-millisecond precision sleep timing

### Sleep Reset Tests
- `reset_future_sleep_before_fire()` (L83-98): Tests resetting sleep deadline before timer fires
- `reset_past_sleep_before_turn()` (L100-115): Tests resetting to earlier deadline before polling
- `reset_past_sleep_before_fire()` (L117-134): Tests resetting to past deadline after time advancement
- `reset_future_sleep_after_fire()` (L136-149): Tests resetting after sleep completion
- `reset_sleep_to_past()` (L151-170): Tests resetting to past time and immediate readiness
- `reset_after_firing()` (L237-260): Tests reset behavior after timer completion

### Edge Cases and Long Duration Tests
- `creating_sleep_outside_of_context()` (L173-181): Tests panic when creating sleep outside runtime context
- `greater_than_max()` (L183-189): Tests extremely long sleep (5 years)
- `short_sleeps()` (L191-196): Stress test with 1000 zero-duration sleeps
- `multi_long_sleeps()` (L198-219): Tests multiple year-long sleeps sequentially
- `long_sleeps()` (L221-235): Tests single 10-year sleep with precision verification
- `exactly_max()` (L262-266): Tests `Duration::MAX` sleep
- `no_out_of_bounds_close_to_max()` (L282-286): Tests near-maximum duration

### Advanced Scenarios
- `issue_5183()` (L268-280): Regression test using `tokio::select!` with very large duration
- `drop_after_reschedule_at_new_scheduled_time()` (L292-312): Tests dropping sleep timer after rescheduling
- `drop_from_wake()` (L314-366): Complex test for dropping timers from wake callback using custom `DropWaker` (L349-365)

## Key Dependencies
- `tokio::time`: Core time functionality (`sleep`, `sleep_until`, `pause`, `Instant`, `Duration`)
- `tokio_test`: Test utilities (`assert_elapsed!`, `assert_pending!`, `assert_ready!`, `task`)
- `futures`: Polling utilities and `ArcWake` trait

## Utility Functions
- `ms()` (L288-290): Convenience function to create `Duration` from milliseconds

## Test Patterns
- All async tests use `time::pause()` for deterministic time control
- Extensive use of `assert_elapsed!` macro for timing verification
- Pin-based sleep manipulation for reset operations
- Manual polling with `futures::poll!` for precise timing control

## Architecture Notes
- Tests verify both absolute (`sleep_until`) and relative (`sleep`) timing
- Reset functionality allows dynamic deadline modification
- Drop safety testing ensures no panics during timer cleanup
- Edge case coverage for duration limits and precision boundaries
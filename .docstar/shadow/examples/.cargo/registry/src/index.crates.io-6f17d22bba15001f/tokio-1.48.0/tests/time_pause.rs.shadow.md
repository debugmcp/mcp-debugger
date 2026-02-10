# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/time_pause.rs
@source-hash: 708d4912742c44b7
@generated: 2026-02-09T18:12:45Z

## Test Suite: Tokio Time Pausing Functionality

This file contains comprehensive tests for Tokio's time pausing and advancement features, specifically testing the `time::pause()`, `time::advance()`, and deterministic time behavior in async contexts.

### Primary Purpose
Tests time manipulation APIs in Tokio, ensuring paused time works correctly across different runtime configurations and provides deterministic behavior for testing async code that depends on timing.

### Key Test Categories

**Basic Pause Tests (L19-49)**
- `pause_time_in_main()` (L20-22): Verifies pausing works in main async context
- `pause_time_in_task()` (L25-31): Tests pausing within spawned tasks
- `pause_time_in_main_threads()` (L36-38): Should panic when pausing in multi-threaded runtime
- `pause_time_in_spawn_threads()` (L43-49): Tests error when pausing in spawned task on multi-threaded runtime

**Deterministic Behavior Tests (L51-72)**
- `paused_time_is_deterministic()` (L52-57): Ensures multiple runs with paused time produce identical results
- `paused_time_stress_run()` (L60-72): Stress test using seeded RNG to generate 10,000 random sleep durations

**Time Advancement Tests (L74-273)**
- `advance_after_poll()` (L75-89): Tests advancing time after polling a sleep future
- `sleep_no_poll()` (L92-105): Tests advancement without polling sleep futures first
- Complex state machine tests using `Tester` struct (L113-186) to test different polling scenarios

**Interval Tests (L188-223)**
- `interval()` (L189-223): Comprehensive test of `time::Interval` behavior with time advancement

**Sub-millisecond Precision Tests (L225-325)**
- Various tests ensuring microsecond-level time advancement works correctly
- Regression tests for specific issues (e.g., `regression_3710_with_submillis_advance` L258-273)

### Key Components

**Tester State Machine (L107-150)**
- Custom `Future` implementation with three states: `Begin`, `AwaitingAdvance`, `AfterAdvance`
- Tests complex interaction between sleep futures and time advancement within same task
- Uses recursive polling pattern via `self.poll(cx)` calls

**Helper Functions**
- `poll_next()` (L327-329): Helper to poll interval ticks
- `ms()` (L331-333): Convenience function to create millisecond durations

### Dependencies
- `tokio::time`: Core time APIs being tested
- `tokio_test`: Assertion macros (`assert_pending`, `assert_ready`, etc.)
- `rand`: For deterministic random number generation in stress tests

### Architecture Notes
- Extensive use of `#[tokio::test(start_paused = true)]` to create paused time contexts
- Platform-specific conditional compilation for WASI and thread-related tests
- Tests cover both single-threaded and multi-threaded runtime scenarios
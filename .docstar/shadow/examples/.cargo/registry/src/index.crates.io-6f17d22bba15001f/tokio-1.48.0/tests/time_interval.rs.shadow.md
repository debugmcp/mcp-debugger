# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/time_interval.rs
@source-hash: 432c2ae588e6a22c
@generated: 2026-02-09T18:12:38Z

**Purpose:** Comprehensive test suite for Tokio's `Interval` timer functionality, testing various missed tick behaviors, reset operations, and edge cases.

**Key Dependencies:**
- `tokio::time`: Core timing utilities (Interval, Duration, Instant, MissedTickBehavior)
- `tokio_test`: Testing utilities for task spawning and assertion macros
- `futures`: Stream trait and extensions

**Core Testing Infrastructure:**

**`check_interval_poll!` macro (L15-25):** Test utility macro that polls an interval task and asserts expected tick times against a start time plus deltas, then verifies the interval is pending.

**`poll_next()` function (L355-357):** Helper that polls an interval's `poll_tick` method within a spawned task context.

**`ms()` function (L359-361):** Convenience function converting milliseconds to Duration.

**Test Categories:**

**Panic Test (L27-31):** Verifies interval creation with zero duration panics as expected.

**Missed Tick Behavior Tests:**
- **`burst()` (L42-75):** Tests default burst behavior where missed ticks are delivered immediately when polling resumes
- **`delay()` (L86-128):** Tests delay behavior using `MissedTickBehavior::Delay` where next tick is scheduled from current time
- **`skip()` (L138-169):** Tests skip behavior using `MissedTickBehavior::Skip` where missed ticks are skipped entirely

**Reset Operation Tests:**
- **`reset()` (L171-205):** Tests basic reset functionality that reschedules from current time
- **`reset_immediately()` (L207-240):** Tests immediate reset that fires next tick right away
- **`reset_after()` (L242-276):** Tests reset with custom duration offset
- **`reset_at()` (L278-312):** Tests reset to specific instant
- **`reset_at_bigger_than_interval()` (L314-353):** Tests reset with delay longer than interval period

**Stream Integration Tests:**

**`IntervalStreamer` struct (L363-405):** Test helper implementing Stream trait that wraps an Interval timer. Counts ticks and yields every 4th count. The `wake_on_pending` field controls whether it self-schedules on `Poll::Pending` returns.

- **`stream_with_interval_poll_tick_self_waking()` (L407-437):** Tests normal stream behavior with self-waking enabled
- **`stream_with_interval_poll_tick_no_waking()` (L439-471):** Tests stream stalling when self-waking is disabled, verifying Interval doesn't reschedule on `Poll::Ready`

**Edge Case Test:**
**`interval_doesnt_panic_max_duration_when_polling()` (L473-477):** Ensures polling an interval with maximum duration doesn't panic.

**Key Patterns:**
- All tests use `#[tokio::test(start_paused = true)]` for deterministic time control
- Tests advance time by 1ms initially due to timer granularity requirements
- Uses 300ms intervals consistently across most tests
- Extensive ASCII art comments document expected vs actual tick timing behavior
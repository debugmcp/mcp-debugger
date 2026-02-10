# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/time/interval.rs
@source-hash: b1ed766f5132335e
@generated: 2026-02-09T18:06:56Z

## Purpose and Responsibility
Provides async interval timing functionality for Tokio applications. Creates periodic timers that can handle missed ticks through configurable strategies, enabling reliable scheduled task execution even when system load or processing delays occur.

## Key Public Functions

**`interval(period: Duration) -> Interval`** (L73-76)
- Creates interval that ticks immediately, then every `period` duration
- Panics if period is zero
- Uses `Burst` missed tick behavior by default
- Equivalent to `interval_at(Instant::now(), period)`

**`interval_at(start: Instant, period: Duration) -> Interval`** (L108-111)  
- Creates interval with custom start time and period
- First tick completes at `start`, subsequent ticks every `period`
- Panics if period is zero

**`internal_interval_at(start, period, location)`** (L114-147)
- Internal constructor with optional tracing support
- Creates boxed `Sleep` future for timing
- Conditionally includes resource span for tracing when `tokio_unstable` + `tracing` features enabled

## Core Types

**`Interval`** (L392-404)
- Main timer struct containing:
  - `delay`: Pin<Box<Sleep>> - underlying sleep future
  - `period`: Duration - interval between ticks  
  - `missed_tick_behavior`: strategy for handling delays
  - `resource_span`: optional tracing span

**`MissedTickBehavior`** enum (L182-337)
- **`Burst`** (L241): Fires ticks rapidly to catch up when behind schedule
- **`Delay`** (L289): Reschedules from current time when tick missed  
- **`Skip`** (L336): Skips to next multiple of period from original start

## Key Interval Methods

**`tick(&mut self) -> Instant`** (L433-448)
- Main async method to wait for next tick
- Returns the instant when tick was scheduled (not when it completes)
- Cancel-safe for use in `tokio::select!`
- Conditionally includes tracing instrumentation

**`poll_tick(&mut self, cx) -> Poll<Instant>`** (L462-494)
- Low-level polling implementation
- Applies missed tick logic when >5ms behind schedule (L478)
- Resets internal delay for next tick
- Returns scheduled time, not completion time

**Reset Methods:**
- `reset()` (L524-526): Reset to current time + period
- `reset_immediately()` (L556-558): Reset to current time  
- `reset_after(after: Duration)` (L589-591): Reset to current time + after
- `reset_at(deadline: Instant)` (L625-627): Reset to specific instant

**Configuration Methods:**
- `missed_tick_behavior()` (L630-632): Get current strategy
- `set_missed_tick_behavior(behavior)` (L635-637): Set strategy
- `period()` (L640-642): Get interval period

## Missed Tick Strategy Details

**`MissedTickBehavior::next_timeout()`** (L341-363)
- Core logic for determining next tick time when behind schedule
- `Burst`: Next = timeout + period (maintains original schedule)
- `Delay`: Next = now + period (resets from current time)
- `Skip`: Complex modular arithmetic to find next multiple of period from start

## Dependencies
- `crate::time::{sleep_until, Duration, Instant, Sleep}` - Core timing primitives
- `crate::util::trace` - Tracing utilities  
- `std::future::poll_fn` - Polling helpers
- `std::pin::Pin` - Self-referential futures
- Optional: `tracing` crate for instrumentation

## Architecture Notes
- Uses boxed `Sleep` futures internally for timing
- Conditional compilation for tracing support
- 5ms tolerance for missed tick detection (L478)
- Default behavior preserves backwards compatibility with `Burst` strategy
- Cancel-safe design allows use in select expressions
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/time/instant.rs
@source-hash: c2b05d621f09ce60
@generated: 2026-02-09T18:06:50Z

## Primary Purpose

Tokio's wrapper around `std::time::Instant` that provides monotonic time measurement with optional test utilities integration. The wrapper enables time manipulation via `time::pause()` and `time::advance()` when testing features are enabled.

## Core Structure

**Instant (L34-36)**: Single-field wrapper struct containing `std::time::Instant`. Implements comprehensive trait derivations for comparison and hashing operations.

## Key Methods

**Construction & Conversion**:
- `now() -> Instant` (L48-50): Current time via feature-dependent variant module
- `from_std(std::time::Instant) -> Instant` (L53-55): Convert from stdlib instant
- `into_std(self) -> std::time::Instant` (L66-68): Convert to stdlib instant
- `far_future() -> Instant` (L57-63): Creates instant ~30 years in future for internal use

**Duration Calculations**:
- `duration_since(&self, earlier: Instant) -> Duration` (L72-74): Saturating duration calculation
- `checked_duration_since(&self, earlier: Instant) -> Option<Duration>` (L93-95): Duration with None for backwards time
- `saturating_duration_since(&self, earlier: Instant) -> Duration` (L114-116): Zero-clamped duration
- `elapsed(&self) -> Duration` (L134-136): Time elapsed since this instant

**Arithmetic**:
- `checked_add(&self, duration: Duration) -> Option<Instant>` (L141-143): Safe addition
- `checked_sub(&self, duration: Duration) -> Option<Instant>` (L148-150): Safe subtraction

## Trait Implementations

**Conversions (L153-163)**: Bidirectional `From` traits for `std::time::Instant` interoperability

**Arithmetic Operators (L165-199)**:
- `Add<Duration>` (L165-171): Addition with duration
- `AddAssign<Duration>` (L173-177): In-place addition
- `Sub` for `Instant` (L179-185): Subtraction yielding duration
- `Sub<Duration>` (L187-193): Subtraction with duration
- `SubAssign<Duration>` (L195-199): In-place subtraction with duration

**Display (L201-205)**: Debug formatting delegates to inner `std::time::Instant`

## Feature-Dependent Architecture

**Production variant (L207-214)**: Direct delegation to `std::time::Instant::now()`

**Test variant (L216-223)**: Uses Tokio's controllable clock system for time manipulation in tests

## Dependencies

- `std::time::{Duration, Instant}`: Core time types
- `crate::time::clock` (test-util only): Tokio's test clock system

## Design Notes

- All duration calculations use saturating arithmetic to prevent panics
- The `far_future()` method uses 30-year offset due to platform-specific overflow constraints
- Feature-conditional compilation enables seamless test/production behavior switching
- Wrapper maintains full API compatibility with `std::time::Instant` while adding Tokio integration
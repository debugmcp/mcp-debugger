# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/time_timeout.rs
@source-hash: 31d4955a4009b24a
@generated: 2026-02-09T18:12:38Z

## Purpose
Test file for Tokio's `timeout` and `timeout_at` functions, verifying behavior in various scenarios including simultaneous completion, past deadlines, future deadlines, and timeout expiration.

## Key Test Functions

### `simultaneous_deadline_future_completion` (L12-18)
Tests immediate future completion with a timeout deadline set to `Instant::now()`. Verifies that ready futures complete successfully even with zero timeout.

### `completed_future_past_deadline` (L22-28) 
Tests behavior when a timeout deadline is already in the past (`Instant::now() - ms(1000)`). Verifies that immediately ready futures still complete successfully despite expired deadline.

### `future_and_deadline_in_future` (L31-52)
Tests scenario where both future and timeout deadline are in the future using `timeout_at`. Uses `time::pause()` and `time::advance()` for controlled time progression. Tests partial time advancement (90ms of 100ms timeout) before completing the future via oneshot channel.

### `future_and_timeout_in_future` (L55-76)
Similar to previous test but uses `timeout()` function instead of `timeout_at()`. Tests relative timeout duration vs absolute deadline.

### `very_large_timeout` (L79-103)
Tests behavior with maximum possible duration timeout (`Duration::MAX` approximation). Advances time by 10 years to verify timeout doesn't expire prematurely with very large values.

### `deadline_now_elapses` (L106-119)
Tests timeout expiration with deadline set to `Instant::now()` and a never-completing `pending()` future. Includes 1ms jitter advance to account for timing precision.

### `deadline_future_elapses` (L122-134)
Tests timeout expiration with future deadline (300ms) and pending future. Advances time past deadline (301ms) to trigger timeout error.

### `timeout_is_not_exhausted_by_future` (L141-151)
Tests that timeout properly interrupts a busy future (infinite read loop) rather than being exhausted by continuous polling.

## Helper Functions

### `ms` (L136-138)
Utility function converting milliseconds to `Duration` for cleaner test code.

## Dependencies
- `tokio::time` - Core timeout functionality and time control
- `tokio::sync::oneshot` - Channel communication for future completion
- `tokio_test` - Test utilities and assertion macros
- `futures::future::pending` - Never-completing future for timeout testing

## Testing Patterns
- Uses `time::pause()` to control time progression in tests
- Uses `task::spawn()` to create pollable futures
- Extensive use of `assert_pending!`, `assert_ready_ok!`, `assert_ready_err!` macros
- Tests both absolute (`timeout_at`) and relative (`timeout`) timeout variants
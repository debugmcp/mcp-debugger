# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/sync_notify.rs
@source-hash: b6fe1c6509790d39
@generated: 2026-02-09T18:12:38Z

## Purpose
Test suite for `tokio::sync::Notify` synchronization primitive, validating notification delivery, queueing semantics, wake ordering, and lifecycle behavior.

## Key Test Categories

### Basic Notification Tests (L15-101)
- `notify_notified_one` (L15-22): Tests immediate notification when notify called after notified future created
- `notify_multi_notified_one` (L24-38): Validates FIFO ordering - first waiter gets notified with `notify_one()`
- `notify_multi_notified_last` (L40-54): Tests LIFO ordering with `notify_last()` - last waiter gets notified
- `notified_one_notify` (L56-66): Tests notification of already-waiting future
- `notified_multi_notify` (L68-83): Confirms only one waiter is woken per `notify_one()` call
- `notify_notified_multi` (L85-101): Tests permit consumption - first `notified()` consumes pending notification

### Drop and Cleanup Tests (L103-181)
- `notified_drop_notified_notify` (L103-118): Validates notification delivery when earlier waiter is dropped
- `notified_multi_notify_drop_one` (L120-138): Tests wake propagation when notified waiter is dropped
- `notified_multi_notify_one_drop` (L140-160): Confirms FIFO ordering maintained after dropping first waiter
- `notified_multi_notify_last_drop` (L162-181): Confirms LIFO ordering maintained after dropping last waiter

### Edge Cases and Reentrancy (L183-215)
- `notify_in_drop_after_wake` (L183-215): Critical deadlock prevention test - validates `notify_waiters()` doesn't deadlock when called from waker's drop implementation. Uses custom `NotifyOnDrop` waker (L191-201) that calls `notify_waiters()` in its destructor.

### Permit Management Tests (L217-285)
- `notify_one_after_dropped_all` (L217-232): Tests permit availability after `notify_waiters()` + `notify_one()`
- `test_notify_one_not_enabled` (L234-241): Tests notification consumption without explicit enable
- `test_notify_one_after_enable` (L243-253): Validates `enable()` behavior and permit consumption
- `test_poll_after_enable` (L255-262): Tests polling after enable call
- `test_enable_after_poll` (L265-271): Tests enable behavior after initial poll
- `test_enable_consumes_permit` (L273-285): Confirms first enable() consumes available permit

### Waker Management Test (L287-303)
- `test_waker_update` (L287-303): Validates waker replacement and proper wake delivery

## Dependencies
- `tokio::sync::Notify`: Main synchronization primitive under test
- `tokio_test::task::spawn`: Creates mockable futures for testing
- `tokio_test::*`: Testing utilities (`assert_ready!`, `assert_pending!`)
- `futures::task`: For custom waker implementation
- `wasm_bindgen_test`: WebAssembly test support (L4-5)

## Key Testing Patterns
- Uses `spawn()` to create testable futures that can be polled manually
- Leverages `assert_pending!`/`assert_ready!` for state verification
- Tests both FIFO (`notify_one()`) and LIFO (`notify_last()`) wake ordering
- Validates proper cleanup when futures are dropped mid-notification
- Tests reentrancy safety in notification delivery

## Architectural Notes
- Validates Send+Sync traits with `AssertSend` trait (L11-13)
- Critical deadlock prevention test ensures notification within waker drop is safe
- Permit system allows notifications to be "stored" for later consumption
- Enable mechanism provides fine-grained control over notification readiness
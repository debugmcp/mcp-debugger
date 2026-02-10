# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/sync_notify_owned.rs
@source-hash: 4b32a676cf05776e
@generated: 2026-02-09T18:12:37Z

## Purpose
Test file for Tokio's `Notify::notified_owned()` method, which returns an owned future that can be awaited to receive notifications. Tests the behavior of owned notification futures across various scenarios including multi-waiter ordering, dropping, and waker interactions.

## Key Components

**Test Utilities Setup (L7-14)**
- Imports Tokio's `Notify`, testing utilities from `tokio_test`
- `AssertSend` trait (L13-14): Compile-time verification that `Notify` implements `Send + Sync`

**Basic Notification Tests (L16-102)**
- `notify_notified_one` (L17-23): Basic notify-then-await pattern
- `notify_multi_notified_one` (L26-39): Tests FIFO ordering with `notify_one()`
- `notify_multi_notified_last` (L42-55): Tests LIFO ordering with `notify_last()`
- `notified_one_notify` (L58-67): Await-then-notify pattern with waker verification
- `notified_multi_notify` (L70-84): Multiple waiters with single notification
- `notify_notified_multi` (L87-102): Pre-notification consumed by first waiter

**Waiter Drop Behavior Tests (L104-182)**
- `notified_drop_notified_notify` (L105-119): Dropped waiter doesn't consume notification
- `notified_multi_notify_drop_one` (L122-139): Notification transfers to remaining waiter when first is dropped
- `notified_multi_notify_one_drop` (L142-161): FIFO ordering maintained after dropping first waiter
- `notified_multi_notify_last_drop` (L164-182): LIFO ordering maintained after dropping last waiter

**Edge Case and Deadlock Prevention (L184-216)**
- `notify_in_drop_after_wake` (L185-216): Tests notification during waker drop to prevent deadlocks
- Uses custom `NotifyOnDrop` struct (L192-202) that notifies on drop via `ArcWake` trait

**Permit and Enabling Tests (L218-286)**
- `notify_one_after_dropped_all` (L219-233): Permit persists after waiter drop
- `test_notify_one_not_enabled` (L236-242): Non-enabled future can still receive notifications
- `test_notify_one_after_enable` (L245-254): Tests `enable()` method behavior before/after notification
- `test_poll_after_enable` (L257-263): Polling after enabling
- `test_enable_after_poll` (L266-272): Enabling after polling
- `test_enable_consumes_permit` (L275-286): First `enable()` call consumes available permit

**Waker Management Test (L288-304)**
- `test_waker_update` (L289-304): Verifies waker updates work correctly with owned futures

## Key Patterns

**Arc-based Ownership**: All tests use `Arc<Notify>` and call `notify.clone().notified_owned().await` to create owned notification futures

**Polling Assertions**: Extensive use of `assert_pending!`, `assert_ready!`, and `is_woken()` to verify async state

**FIFO/LIFO Testing**: Systematic verification of waiter ordering with `notify_one()` vs `notify_last()`

**Drop Safety**: Tests ensure proper cleanup and notification transfer when waiters are dropped

## Dependencies
- `tokio::sync::Notify`: Core notification primitive
- `tokio_test`: Testing utilities for async code
- `futures`: Used in advanced waker scenarios
- `std::sync::Arc`: Reference counting for shared ownership
# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/tests/loom_watch.rs
@source-hash: c5cdba8a19b25e99
@generated: 2026-02-09T18:03:23Z

## Purpose and Responsibility
Loom-based concurrency test suite for Tokio's `watch` channel implementation. Uses the Loom model checker to verify correctness of watch channels under various concurrent access patterns and race conditions.

## Key Dependencies
- `crate::sync::watch` - The watch channel implementation being tested
- `loom::future::block_on` - Deterministic async execution for model checking
- `loom::thread` - Deterministic thread spawning for model checking
- `std::sync::Arc` - Shared ownership for concurrent scenarios

## Test Functions

### `smoke` (L7-37)
Basic multi-receiver test verifying that:
- Multiple receivers can be cloned from a single receiver
- All receivers observe the same value change when sender updates
- Concurrent send/receive operations work correctly
- Creates 5 receiver clones and verifies they all see the value change from 1 to 2

### `wait_for_test` (L39-63)
Tests the `wait_for` predicate-based waiting functionality:
- Uses Arc-wrapped sender for shared ownership across threads
- Thread 1 performs no-op modifications via `send_modify`
- Thread 2 sends the target value (true)
- Verifies receiver waits until predicate condition is met

### `wait_for_returns_correct_value` (L65-90)
Validates that `wait_for` returns the exact value that satisfied the predicate:
- Sender rapidly sends values 1, 2, 3 in sequence
- Receiver captures the first value it observes via predicate closure
- Asserts that the returned value matches the value that caused predicate to return true
- Tests race condition handling between rapid sends and predicate evaluation

### `multiple_sender_drop_concurrently` (L92-110)
Tests sender lifecycle and channel closure semantics:
- Creates two senders via cloning
- Drops senders concurrently from different threads
- Verifies `has_changed()` behavior before and after all senders are dropped
- Ensures channel properly transitions to closed state when last sender is dropped

## Testing Patterns
- All tests use `loom::model()` wrapper for exhaustive concurrency model checking
- Deterministic execution via loom's controlled threading and async runtime
- Focus on race conditions, memory ordering, and channel state transitions
- Systematic verification of watch channel's multi-producer, multi-consumer semantics
# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/tests/loom_notify.rs
@source-hash: e97a97615ee1f8db
@generated: 2026-02-09T18:03:26Z

## Loom-based Concurrency Tests for Tokio Notify

**Primary Purpose:** Comprehensive concurrency testing for Tokio's `Notify` synchronization primitive using the Loom model checker to detect race conditions and verify correctness under all possible thread interleavings.

**Key Test Functions:**

- `notify_one()` (L13-27): Basic single-waiter notification test - spawns thread waiting on `notified().await`, then calls `notify_one()`
- `notify_waiters()` (L30-48): Multi-waiter broadcast test - creates multiple `Notified` futures, then calls `notify_waiters()` to wake all
- `notify_waiters_and_one()` (L51-77): Concurrent notification test - spawns threads calling both `notify_waiters()` and `notify_one()` simultaneously
- `notify_multi()` (L80-107): Chain notification test - threads wait, notify next waiter, creating a notification cascade
- `notify_drop()` (L110-144): Drop safety test - verifies behavior when `Notified` futures are dropped while being polled
- `notify_waiters_poll_consistency()` (L150-183): Consistency verification - ensures `notify_waiters()` either wakes all polled futures or none
- `notify_waiters_poll_consistency_many()` (L192-223): Extended consistency test with `WAKE_LIST_SIZE + 1` futures to test chunked processing
- `notify_waiters_is_atomic()` (L228-268): Atomicity test - verifies `notify_waiters()` appears atomic when combined with concurrent `notify_one()`
- `notify_waiters_sequential_notified_await()` (L277-330): Sequential await test - ensures single `notify_waiters()` doesn't satisfy sequentially created `Notified` futures

**Critical Constants:**
- `WAKE_LIST_SIZE: usize = 32` (L10): References internal wake list chunk size from `util::wake_list::NUM_WAKERS`

**Key Dependencies:**
- `loom` framework: Provides `model()`, deterministic threading (`thread`), async execution (`block_on`), and atomic operations (`Arc`)
- `tokio_test`: Supplies `assert_pending!`, `assert_ready!` macros for future polling verification
- `crate::sync::Notify`: The synchronization primitive under test
- `crate::sync::oneshot`: Used for inter-thread coordination in complex scenarios (L278)

**Testing Patterns:**
1. **Model-based testing**: All tests wrapped in `loom::model()` to explore all possible execution orders
2. **Future polling verification**: Extensive use of `tokio_test::task::spawn()` and manual polling to verify notification states
3. **Thread synchronization**: Uses `Arc::clone()` for shared ownership and `thread::spawn()` for concurrent execution
4. **Consistency assertions**: Critical invariant checks like "if first future ready, second must be ready" (L172, L215)

**Architectural Insights:**
- Tests verify that `notify_waiters()` has chunked processing behavior (evident from `WAKE_LIST_SIZE + 1` patterns)
- Notification system must handle concurrent drops safely
- Sequential `notified().await` calls should not be satisfied by single `notify_waiters()` call
- System maintains strong consistency guarantees under concurrent access
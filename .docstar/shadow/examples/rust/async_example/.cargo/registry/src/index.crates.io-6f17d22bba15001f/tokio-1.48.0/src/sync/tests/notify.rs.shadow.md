# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/tests/notify.rs
@source-hash: c4894a0446a2ec36
@generated: 2026-02-09T18:03:24Z

## Primary Purpose
Test suite for `tokio::sync::Notify` synchronization primitive, focusing on edge cases including waker cloning behavior, panic handling, and basic notification functionality.

## Key Test Functions

### `notify_clones_waker_before_lock` (L9-46)
Tests that Notify doesn't hold locks during waker cloning operations to prevent deadlocks. Creates custom `RawWakerVTable` with:
- `clone_w` (L13-20): Intentionally calls `notify_one()` during waker cloning to test lock safety
- `drop_w` (L22-24): Properly drops Arc reference count
- `wake` and `wake_by_ref` (L26-32): Marked unreachable as they shouldn't be called

Key pattern: Uses `Arc::into_raw` and custom waker vtable to simulate real-world waker behavior while testing internal locking mechanisms.

### `notify_waiters_handles_panicking_waker` (L48-85)
**Conditional compilation**: Only compiled with `panic = "unwind"`
Tests panic resilience when wakers panic during notification:
- `PanickingWaker` struct (L55-61): Implements `ArcWake` with guaranteed panic on wake
- Creates 32 pending futures (L70-75) then calls `notify_waiters()` in panic-catching context
- Verifies all futures still complete despite waker panic, ensuring notification robustness

### `notify_simple` (L87-101)
Basic functionality test verifying `notify_waiters()` wakes all pending futures simultaneously.

### `watch_test` (L103-119)
**Platform-specific**: Excluded on WASM targets
Integration test using `crate::sync::watch` channel within async runtime context, demonstrating cross-component interaction.

## Key Dependencies
- `crate::sync::Notify`: Primary synchronization primitive under test
- `futures::task::ArcWake`: For custom waker implementations
- `tokio_test::task::spawn`: Test harness for polling futures
- `std::task::{RawWaker, RawWakerVTable}`: Low-level waker construction

## Architectural Patterns
- **Custom Waker Testing**: Uses raw waker vtables to test internal locking behavior
- **Panic Safety**: Ensures notification system remains functional despite panicking wakers
- **Cross-platform Compatibility**: Conditional compilation for WASM and panic handling

## Critical Invariants
- Waker cloning must not hold Notify internal locks (prevents deadlock)
- `notify_waiters()` must complete all pending futures even if some wakers panic
- All notification operations must be atomic and consistent
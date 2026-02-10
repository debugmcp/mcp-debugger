# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/tests/loom_atomic_waker.rs
@source-hash: cc34dad700ed3ab3
@generated: 2026-02-09T18:03:20Z

## Purpose
Loom-based concurrency tests for Tokio's `AtomicWaker` primitive, validating thread-safe task notification mechanisms under different execution interleavings.

## Key Components

### Chan struct (L11-14)
Simple channel-like structure combining:
- `num`: `AtomicUsize` counter for tracking notifications
- `task`: `AtomicWaker` for async task coordination

### basic_notification test (L16-45)
Tests fundamental `AtomicWaker` functionality:
- Spawns `NUM_NOTIFY` (2) threads that increment counter and call `wake()` (L29-32)
- Main task registers waker and polls until all notifications received (L35-43)
- Validates proper wake-up coordination between threads and async task

### test_panicky_waker test (L47-100)
Tests `AtomicWaker` robustness against panicking wakers:
- Creates custom `RawWakerVTable` with panicking clone function (L53-54)
- Constructs panicking waker using unsafe `Waker::from_raw` (L56)
- Tests that panic during `register_by_ref` doesn't corrupt waker state (L88)
- Verifies normal operation continues after panic recovery (L90-98)

## Dependencies
- `loom`: Deterministic concurrency testing framework
- `crate::sync::task::AtomicWaker`: Target component under test
- Standard library atomics and async primitives

## Testing Patterns
Uses loom's `model()` function for exhaustive execution interleaving exploration. Both tests follow similar structure:
1. Create shared `Chan` wrapped in `Arc`
2. Spawn notifying threads
3. Block on polling future that waits for notifications
4. Verify completion conditions

## Critical Invariants
- `AtomicWaker` must handle concurrent wake calls safely
- Panic in waker operations must not leave waker in corrupted state
- Wake notifications must not be lost during registration races
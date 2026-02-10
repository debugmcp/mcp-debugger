# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/tests/loom_semaphore_batch.rs
@source-hash: ee72dd9df90089a2
@generated: 2026-02-09T18:03:25Z

**Purpose:** Loom-based concurrent testing suite for Tokio's batch semaphore implementation, validating thread-safety and correctness under various race conditions and concurrent scenarios.

**Key Dependencies:**
- `crate::sync::batch_semaphore::*` - The semaphore implementation under test
- `loom` framework - Deterministic concurrency testing with model checking
- Standard async/sync primitives for coordination

**Test Functions:**

**`basic_usage` (L13-48):** Core semaphore functionality test with shared state tracking. Creates `Shared` struct (L17-20) containing semaphore and active counter. The `actor` async function (L22-30) acquires permits, increments active counter with bounds checking, then releases. Uses `NUM=2` concurrent actors to verify permit limits are respected.

**`release` (L50-67):** Simple acquire-release cycle test across threads. One thread acquires and releases a permit, main thread then acquires to verify proper release mechanics.

**`basic_closing` (L69-92):** Tests semaphore closure behavior with `NUM=2` threads. Each thread performs 2 acquire-release cycles, then main thread closes the semaphore to verify graceful shutdown.

**`concurrent_close` (L94-113):** Race condition test for concurrent closure. `NUM=3` threads each acquire, release, then attempt to close the semaphore simultaneously.

**`concurrent_cancel` (L115-157):** Complex cancellation scenario testing. The `poll_and_cancel` async function (L117-135) creates two acquire futures, polls them once, then immediately drops them to simulate timeouts/cancellations. Three threads run this concurrently with a zero-permit semaphore, then permits are released to test cleanup of cancelled waiters.

**`batch` (L159-197):** Batch operation testing with reduced preemption bound. Two threads each acquire varying batch sizes [4, 10, 8] with active permit tracking to ensure total never exceeds semaphore capacity (10). Uses explicit thread yielding to increase scheduling pressure.

**`release_during_acquire` (L199-214):** Tests release occurring while another thread is blocked on acquire. Initial thread acquires 8 permits, blocking thread waits for 4, then permits are released to unblock.

**`concurrent_permit_updates` (L216-242):** Multi-threaded permit manipulation test combining release (3 permits), try_acquire (1 permit), and forget_permits (2 permits) operations to verify atomic state management.

**Testing Strategy:** All tests use `loom::model()` for exhaustive scheduling exploration, ensuring race-free operation across all possible thread interleavings. Critical invariants tested include permit count limits, proper release mechanics, and cleanup of cancelled operations.
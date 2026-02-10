# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/tests/loom_multi_thread/shutdown.rs
@source-hash: 2f48626eb0a4135d
@generated: 2026-02-09T17:58:18Z

**Purpose**: Loom-based concurrency test for Tokio runtime shutdown behavior, specifically testing that spawned tasks are properly cancelled when the runtime is dropped.

**Test Function**:
- `join_handle_cancel_on_shutdown()` (L3-28): Main test function that verifies join handles are cancelled during runtime shutdown

**Test Logic**:
1. **Loom Setup** (L5-6): Configures loom model with preemption bound of 2 for deterministic concurrency testing
2. **Runtime Creation** (L10-13): Creates multi-threaded Tokio runtime with 2 worker threads
3. **Handle Acquisition** (L15): Obtains runtime handle via `block_on` and `Handle::current()`
4. **Task Spawning** (L17): Spawns first pending task before runtime shutdown
5. **Runtime Drop** (L19): Explicitly drops runtime to trigger shutdown
6. **Post-Shutdown Spawn** (L21): Spawns second task after runtime has been dropped
7. **Cancellation Verification** (L23-26): Asserts both tasks are cancelled using `now_or_never()` and `is_cancelled()`

**Key Dependencies**:
- `crate::runtime::{Builder, Handle}` (L1): Tokio runtime components
- `futures::future::FutureExt` (L8): For `now_or_never()` method
- `loom::model::Builder` (L5): Concurrency testing framework

**Test Pattern**: Uses Loom's deterministic concurrency testing to verify that:
- Tasks spawned before shutdown are cancelled when runtime drops
- Tasks spawned after shutdown immediately fail with cancellation
- Proper cleanup semantics are maintained across thread boundaries

**Invariants Tested**:
- Runtime shutdown must cancel all pending tasks
- Handle spawn attempts after shutdown must fail gracefully
- Cancellation state must be observable through join handle APIs
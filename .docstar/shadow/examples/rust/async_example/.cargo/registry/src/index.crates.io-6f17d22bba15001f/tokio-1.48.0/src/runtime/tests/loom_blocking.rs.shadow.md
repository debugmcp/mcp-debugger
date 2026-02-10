# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/tests/loom_blocking.rs
@source-hash: fb4bf871ae59cd56
@generated: 2026-02-09T18:03:14Z

**Purpose:** Loom-based concurrency testing for Tokio's blocking task spawning mechanisms, ensuring thread safety and proper resource cleanup under various runtime shutdown scenarios.

**Dependencies:**
- Uses `loom` framework for exhaustive concurrency testing
- Imports Tokio runtime components (`runtime`, `Runtime`)
- Uses `Arc` for shared ownership tracking
- Depends on `loom_oneshot` channel for synchronization testing

**Key Test Functions:**

**`blocking_shutdown` (L5-24):**
- Tests proper cleanup of `spawn_blocking` tasks during runtime shutdown
- Creates 2 blocking tasks that hold Arc references to verify reference counting
- Ensures no memory leaks by checking Arc strong_count drops to 1 after runtime drop
- Uses `mk_runtime(1)` helper for single-threaded runtime

**`spawn_mandatory_blocking_should_always_run` (L26-45):**
- Verifies `spawn_mandatory_blocking` executes even during runtime shutdown
- Uses oneshot channel to detect task execution completion
- Critical test for ensuring mandatory blocking tasks aren't dropped during shutdown
- Comment L42: Documents deadlock prevention mechanism

**`spawn_mandatory_blocking_should_run_even_when_shutting_down_from_other_thread` (L47-74):**
- Tests cross-thread runtime shutdown scenario with mandatory blocking tasks
- Spawns separate thread to drop runtime while main thread schedules mandatory task
- Uses conditional execution based on handle availability (L69)
- Ensures mandatory tasks run even when runtime is being torn down from another thread

**`spawn_blocking_when_paused` (L76-95):**
- Tests blocking task execution in paused time runtime environment
- Uses `start_paused(true)` and `enable_time()` for controlled time testing
- Verifies blocking tasks complete within timeout despite paused time
- Tests interaction between time-paused runtime and blocking thread pool

**Helper Function:**
**`mk_runtime` (L97-102):** Creates multi-threaded runtime with specified worker thread count

**Testing Patterns:**
- All tests wrapped in `loom::model()` for exhaustive state space exploration
- Uses `_enter = rt.enter()` pattern for runtime context management
- Consistent pattern of runtime creation → task spawning → runtime drop → verification
- Arc reference counting used as cleanup verification mechanism

**Architectural Notes:**
- Tests focus on shutdown semantics and resource management
- Mandatory blocking tasks have different lifecycle guarantees than regular blocking tasks
- Cross-thread shutdown scenarios require special handling for task completion guarantees
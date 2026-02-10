# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/task/join_set.rs
@source-hash: e005d9b52e534628
@generated: 2026-02-09T18:06:54Z

**Primary Purpose:** Provides `JoinSet<T>` - a collection for managing multiple spawned tasks with homogeneous return types, allowing asynchronous awaiting of task completion in completion order.

**Core Components:**

**JoinSet<T> struct (L64-66):**
- Wraps `IdleNotifiedSet<JoinHandle<T>>` for task storage and notification management
- Generic over task return type `T`
- Auto-aborts all tasks on drop (L591-595)

**Builder<'a, T> struct (L75-78):** [tokio_unstable + tracing feature only]
- Configuration wrapper for task spawning with custom settings (names, etc.)
- References mutable JoinSet and encapsulates task::Builder

**Key Methods:**

**Task Spawning:**
- `spawn()` (L142-149): Spawn on current runtime, returns AbortHandle
- `spawn_on()` (L161-168): Spawn on specific runtime handle
- `spawn_local()` (L186-192): Spawn on current LocalSet
- `spawn_local_on()` (L206-212): Spawn on specific LocalSet
- `spawn_blocking()` (L254-261): Spawn blocking task on threadpool
- `spawn_blocking_on()` (L269-276): Spawn blocking on specific runtime
- `build_task()` (L122-127): Returns Builder for configured spawning [unstable]

**Task Completion Handling:**
- `join_next()` (L296-298): Async wait for next completion, returns None if empty
- `join_next_with_id()` (L316-318): Same as above but includes task ID
- `try_join_next()` (L323-340): Non-blocking completion check
- `try_join_next_with_id()` (L352-369): Non-blocking with task ID
- `poll_join_next()` (L500-527): Low-level polling interface
- `poll_join_next_with_id()` (L556-588): Low-level polling with task ID

**Collection Management:**
- `join_all()` (L446-457): Consume JoinSet, return Vec of all results (panics on errors)
- `shutdown()` (L381-384): Abort all tasks and wait for completion
- `abort_all()` (L463-465): Abort all tasks without waiting
- `detach_all()` (L471-473): Remove tasks without aborting (continue running)

**Utilities:**
- `len()`, `is_empty()` (L89-96): Collection size queries
- `new()` (L82-86): Constructor
- `insert()` (L278-285): Internal helper for adding JoinHandle and setting up waker

**Key Dependencies:**
- `IdleNotifiedSet` from `crate::util` for task storage and notification
- `JoinHandle`, `AbortHandle`, `JoinError` from task system
- `unconstrained()` for coop budget bypass during polling

**Important Patterns:**
- Cancel safety: `join_next*` methods guarantee no task removal on cancellation
- Coop scheduling awareness: Uses `unconstrained()` in non-async polling contexts
- Task ID tracking: Maintains unique IDs while tasks are in the set
- RAII cleanup: Auto-aborts tasks on JoinSet drop

**Critical Invariants:**
- All tasks must have same return type `T`
- Tasks are returned in completion order, not spawn order
- Empty JoinSet returns None from join operations
- Task IDs remain unique while tracked in JoinSet

**FromIterator Implementation (L637-650):**
- Allows collecting iterators of futures into JoinSet via `collect()`
- Requires `F: Future<Output = T> + Send + 'static` and `T: Send + 'static`
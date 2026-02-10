# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/task/local.rs
@source-hash: a71596390f2e2b26
@generated: 2026-02-09T18:07:00Z

**Purpose**: Implements `LocalSet` for spawning and executing `!Send` futures on a single thread, enabling use of non-Send types like `Rc<T>` within async tasks.

## Core Types

### LocalSet (L225-234)
Main executor for `!Send` futures. Contains:
- `tick: Cell<u8>` - scheduler tick counter for queue fairness
- `context: Rc<Context>` - shared state with scheduling logic  
- `_not_send: PhantomData<*const ()>` - ensures `!Send` to prevent cross-thread movement

### Context (L238-245)
Thread-local state container:
- `shared: Arc<Shared>` - thread-safe shared state
- `unhandled_panic: Cell<bool>` - tracks panic state for shutdown behavior

### Shared (L248-264) 
Thread-shared state with thread-safety enforced by ownership model:
- `local_state: LocalState` - **SAFETY CRITICAL**: only accessible from owner thread
- `queue: Mutex<VecDeque<>>` - remote task queue for cross-thread scheduling
- `waker: AtomicWaker` - wakes the LocalSet future when tasks are scheduled

### LocalState (L268-277)
Owner-thread-only state:
- `owner: ThreadId` - thread that created this LocalSet
- `local_queue: UnsafeCell<VecDeque<>>` - high-priority local task queue
- `owned: LocalOwnedTasks<>` - tracks all spawned tasks for cleanup

## Key Functions

### spawn_local (L381-392)
Free function to spawn `!Send` futures. Checks future size against `BOX_FUTURE_THRESHOLD` and boxes large futures for performance. Delegates to `spawn_local_inner`.

### spawn_local_inner (L396-445)
Core spawning logic with dual-path execution:
1. **LocalRuntime path**: Direct spawning on runtime-managed LocalSet
2. **LocalSet path**: Uses thread-local `CURRENT` to find active LocalSet context

### LocalSet::tick (L741-764)
Scheduler execution unit that:
- Processes up to `MAX_TASKS_PER_TICK` (61) tasks per call
- Checks for unhandled panics and asserts if found
- Returns boolean indicating if more work remains

### next_task (L766-795)
Task selection with fairness algorithm:
- Every `REMOTE_FIRST_INTERVAL` (31) ticks, checks remote queue first
- Otherwise prioritizes local queue over remote queue
- Converts `Notified` to `LocalNotified` via ownership assertion

## Scheduling Strategy

### Queue Prioritization
Two-level queue system:
- **Local queue**: High priority, thread-local, unsafe access
- **Remote queue**: Lower priority, mutex-protected, cross-thread safe

### Task Routing (schedule function L1080-1121)
Intelligent task placement based on execution context:
1. **Active LocalSet being polled**: Direct local queue insertion (no wake needed)
2. **Owner thread, inactive LocalSet**: Local queue + wake
3. **Foreign thread**: Remote queue + wake

## Thread Safety Model

Uses ownership-based safety rather than traditional Send/Sync:
- `Shared` implements `Sync` but `local_state` field requires owner-thread access
- `LocalState` implements `Send` but usage restricted to owner thread
- All unsafe local_state access guarded by `assert_called_from_owner_thread` (L1237-1250)

## Integration Points

### Thread-Local Storage (L288-291)
`CURRENT` stores active LocalSet context with:
- `ctx: RcCell<Context>` - current LocalSet context
- `wake_on_schedule: Cell<bool>` - optimization flag for polling state

### Runtime Integration
- Integrates with `LocalRuntime` for direct task spawning
- Falls back to LocalSet context when not in LocalRuntime
- Supports task tracing and debugging features under unstable flags

## Configuration (Unstable)
- `unhandled_panic` behavior: `Ignore` (default) vs `ShutdownRuntime`
- Runtime ID access for debugging and introspection
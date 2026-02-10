# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/task/
@generated: 2026-02-09T18:16:48Z

## Purpose & Responsibility

This directory implements Tokio's core async task management system - the fundamental infrastructure for spawning, executing, and managing asynchronous tasks within the runtime. It provides a complete task lifecycle implementation with reference counting, state machines, and cooperative scheduling.

## Key Components & Architecture

### Task Representation & Memory Layout
- **Core (`core.rs`)**: Defines cache-aligned memory structures (`Cell<T,S>`, `Core<T,S>`, `Header`, `Trailer`) optimized for different CPU architectures to prevent false sharing. Implements the fundamental task memory layout with hot/cold data separation.
- **Raw Task (`raw.rs`)**: Type-erased task representation using vtables for dynamic dispatch. Provides `RawTask` handles and function pointer tables enabling task operations without type information.
- **State Management (`state.rs`)**: Atomic bitfield-based state machine managing task lifecycle (RUNNING, COMPLETE, NOTIFIED, CANCELLED), reference counting, and join handle coordination through lock-free operations.

### Task Lifecycle Management
- **Harness (`harness.rs`)**: Low-level task execution engine handling polling, waking, completion, and cleanup. Implements the core state transitions and panic recovery with careful reference counting.
- **Task Handles (`mod.rs`)**: Defines the primary task types - `Task<S>` (owned), `Notified<S>` (ready for scheduling), `LocalNotified<S>` (thread-local), and `UnownedTask<S>` (blocking tasks).

### User-Facing API
- **JoinHandle (`join.rs`)**: Primary user interface for awaiting task completion, similar to `std::thread::JoinHandle`. Implements `Future` trait and provides abort capabilities.
- **AbortHandle (`abort.rs`)**: Lightweight handle for remote task cancellation without join capabilities. Enables task abortion from any thread.
- **Error Handling (`error.rs`)**: `JoinError` type representing task failures (cancellation or panic) with task ID context.

### Task Storage & Organization  
- **Task Lists (`list.rs`)**: Thread-safe (`OwnedTasks`) and single-threaded (`LocalOwnedTasks`) task containers using sharded linked lists. Supports graceful shutdown and ownership verification.
- **Task Identification (`id.rs`)**: Unique task ID generation and current task context retrieval using atomic counters.

### Async Integration
- **Waker Implementation (`waker.rs`)**: Bridges std::task::Waker with Tokio's task system using reference-counted waking with unified vtables.
- **Tracing (`trace/`)**: Optional execution tracing infrastructure for debugging async task execution patterns and performance analysis.

## Public API Surface

### Primary Entry Points
- **Task Creation**: `new_task<T, S>()` creates `Task`, `Notified`, and `JoinHandle` trio
- **Task Spawning**: Integration with scheduler's `bind()` methods on task lists
- **Await Interface**: `JoinHandle<T>` implements `Future` for awaiting completion
- **Cancellation**: `JoinHandle::abort()` and `AbortHandle::abort()` for task termination
- **Current Context**: `id::id()` and `id::try_id()` for accessing current task ID

### Scheduler Integration
- **Schedule Trait**: Abstract interface (`schedule()`, `release()`, `yield_now()`, `unhandled_panic()`) that runtime schedulers must implement
- **Task Execution**: `LocalNotified::run()` and `UnownedTask::run()` for scheduler-driven task execution

## Internal Organization & Data Flow

1. **Task Creation**: `new_task()` allocates cache-aligned `Cell` structures and creates typed handles
2. **Scheduling**: Tasks move through `Task` → `Notified` → execution → completion lifecycle
3. **Execution**: `Harness` polls futures within atomic state machine constraints
4. **State Coordination**: Atomic transitions manage concurrent access to task state and wakers
5. **Memory Management**: Reference counting ensures safe deallocation across handle types
6. **Completion**: Results stored in task cell and made available through `JoinHandle`

## Important Patterns & Conventions

### Thread Safety Model
- Send tasks use sharded `OwnedTasks` for concurrent access
- Non-Send tasks limited to single-threaded `LocalOwnedTasks`
- Atomic state machine prevents race conditions during task execution

### Reference Counting Strategy
- Multiple reference types (`Task`, `JoinHandle`, `AbortHandle`) with distinct cleanup responsibilities
- Reference counting integrated into state transitions for lock-free coordination
- Separate fast/slow paths for common operations like handle dropping

### Memory Safety Guarantees
- Extensive use of `NonNull` pointers with careful lifetime management
- Unsafe operations isolated to well-documented modules (`raw.rs`, `core.rs`)
- Vtable-based dynamic dispatch maintains type safety across erasure boundaries

### Cooperative Scheduling
- Budget tracking prevents task monopolization
- Voluntary yielding through waker-based resumption
- Integration with Tokio's broader cooperative scheduling system

This module forms the foundation of Tokio's async task system, providing the essential infrastructure that higher-level spawn functions and runtime schedulers build upon.
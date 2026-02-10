# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/task/
@generated: 2026-02-09T18:16:14Z

## Overall Purpose

The `task` module is the core of Tokio's green-thread task system, providing APIs for spawning, managing, and coordinating asynchronous tasks. It implements a cooperative multitasking system where tasks voluntarily yield control at `.await` points, enabling high-concurrency execution on a small number of OS threads.

## Key Components and Architecture

### Task Spawning and Execution
- **`spawn.rs`**: Core spawning infrastructure with `spawn()` function for Send futures
- **`local.rs`**: LocalSet system for spawning `!Send` futures on single threads
- **`blocking.rs`**: Bridge to blocking operations via `spawn_blocking()` and `block_in_place()`
- **`builder.rs`**: Builder pattern for configuring task spawning with metadata (names, etc.)

### Task Management
- **`join_set.rs`**: Collection-based task management for homogeneous task groups
- **Task handles**: JoinHandle for awaiting completion, AbortHandle for cancellation
- **Task identification**: Unique IDs for debugging and runtime introspection

### Cooperative Scheduling
- **`yield_now.rs`**: Explicit yielding mechanism for fairness
- **`coop/`**: Budget-based cooperative scheduling system (referenced but not detailed)
- **Task-local storage** (`task_local.rs`): Scoped storage within individual tasks

## Public API Surface

### Primary Entry Points
- **`spawn<F>(future: F) -> JoinHandle<F::Output>`**: Main task spawning API
- **`spawn_local<F>(future: F) -> JoinHandle<F::Output>`**: For !Send futures  
- **`spawn_blocking<F>(f: F) -> JoinHandle<F::Output>`**: For blocking operations
- **`yield_now() -> impl Future<Output = ()>`**: Cooperative yielding

### Task Management
- **`JoinSet<T>`**: Manages multiple tasks of same return type
- **`LocalSet`**: Single-threaded executor for !Send tasks
- **`Builder`**: Configurable task spawning with metadata

### Storage and Utilities
- **`task_local!` macro**: Declares task-scoped storage keys
- **Task IDs**: `id()`, `try_id()` for current task identification
- **Cooperative scheduling**: Budget management and yielding controls

## Internal Organization and Data Flow

### Task Lifecycle
1. **Creation**: Tasks created via spawn functions with size-based boxing optimization
2. **Scheduling**: Tasks queued in runtime schedulers (local/remote queues for LocalSet)
3. **Execution**: Cooperative polling with yield points at `.await`
4. **Completion**: Results retrieved via JoinHandle or collected in JoinSet

### Thread Safety Model
- **Send tasks**: Can migrate between threads in multi-threaded runtime
- **!Send tasks**: Confined to single thread via LocalSet with ownership-based safety
- **Blocking operations**: Isolated to dedicated thread pools

### Queue Management
- **Local queues**: High-priority, single-threaded access
- **Remote queues**: Cross-thread task injection with mutex protection
- **Fairness algorithms**: Periodic remote queue checking, task count limits per tick

## Important Patterns and Conventions

### Size Optimization
All spawning functions check `BOX_FUTURE_THRESHOLD` and automatically box large futures to prevent stack overflow.

### Error Handling
- Panics for invalid runtime context (spawning outside Tokio runtime)
- JoinError for task panics and cancellation
- Cooperative cancellation - tasks must yield to be cancelled

### Resource Management
- Auto-abort semantics: JoinSet aborts all tasks on drop
- Blocking operations have separate thread pool with configurable limits
- Task-local storage uses RAII guard pattern for cleanup

### Conditional Compilation
Extensive use of feature gates (`cfg_rt!`, `cfg_rt_multi_thread!`) to include only relevant functionality based on runtime configuration.

## Critical Design Invariants

- Tasks are cooperative, not preemptive - must yield at await points
- Send bounds enforced at compile time for cross-thread safety  
- LocalSet provides single-threaded execution guarantees for !Send types
- Task cancellation is cooperative and may not be immediate
- All spawning requires active runtime context
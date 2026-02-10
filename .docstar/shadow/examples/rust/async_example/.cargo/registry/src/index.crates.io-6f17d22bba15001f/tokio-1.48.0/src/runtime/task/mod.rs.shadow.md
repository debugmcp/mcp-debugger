# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/task/mod.rs
@source-hash: 65c2f67bfc64279b
@generated: 2026-02-09T18:03:16Z

## Purpose
Core task module for Tokio's async runtime. Manages spawned tasks through reference-counted handles with atomic state transitions. Provides safe API for task lifecycle management, including spawning, scheduling, cancellation, and cleanup.

## Key Components

### Task Reference Types (L237-287)
- **Task<S>** (L237): Owned handle tracked by reference count
- **Notified<S>** (L246): Wrapper indicating task was notified and ready for scheduling
- **LocalNotified<S>** (L265): Non-Send variant for thread-local tasks
- **UnownedTask<S>** (L280): For blocking tasks, holds two ref-counts

### State Management
Atomic `usize` bitfields for task coordination:
- RUNNING: Lock around task polling/cancellation
- COMPLETE: Set when future completes, never unset
- NOTIFIED: Tracks existence of Notified object
- CANCELLED: Marks tasks for cancellation
- JOIN_INTEREST: Indicates JoinHandle exists
- JOIN_WAKER: Access control for waker field

### Core Functions

#### Task Creation (L328-391)
- **new_task<T, S>()** (L328): Creates Task, Notified, and JoinHandle trio
- **unowned<T, S>()** (L362): Creates UnownedTask + JoinHandle for blocking tasks

#### Task Operations
- **Task::shutdown()** (L497): Preemptive cancellation during runtime shutdown
- **LocalNotified::run()** (L506): Executes task on local thread
- **UnownedTask::run()** (L535): Executes blocking task with dual ref-count management

### Scheduling Interface
**Schedule trait** (L298-321): Required implementation for task schedulers
- `release()`: Batch ref-dec with task release
- `schedule()`: Queue notified task
- `yield_now()`: Cooperative yielding
- `unhandled_panic()`: Panic handling policy

### Safety Mechanisms
- Reference counting for memory safety (Drop impls L556-574)
- RUNNING bitfield prevents concurrent access
- Non-Send task binding to LocalOwnedTasks
- JOIN_WAKER protocol for safe concurrent waker access

### Utilities
- **SpawnLocation** (L624-656): Conditional location tracking for debugging
- LinkedList and ShardedList implementations for task containers (L591-619)

## Dependencies
- Internal: `core`, `harness`, `state`, `waker`, `raw` modules
- External: `std::panic::Location`, `PhantomData`, `NonNull`

## Architecture Notes
- Reference counting handles task lifetime
- Atomic state machine prevents races
- Scheduler abstraction allows pluggable runtime backends
- Conditional compilation for unstable features
# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/multi_thread/handle.rs
@source-hash: ef12bec02e33e0d1
@generated: 2026-02-09T17:58:18Z

## Purpose
Handle for Tokio's multi-threaded runtime scheduler. Provides the primary interface for spawning tasks onto a thread pool and managing runtime resources. Acts as the coordinator between task scheduling, I/O drivers, and blocking operations.

## Key Components

### Handle struct (L21-36)
Main handle structure containing:
- `shared` (L23): Worker thread pool interface via `worker::Shared`
- `driver` (L26): I/O resource driver handles for async operations
- `blocking_spawner` (L29): Spawner for blocking tasks that run on separate thread pool
- `seed_generator` (L32): RNG seed generator for task scheduling randomization
- `task_hooks` (L35): User-defined callbacks for task lifecycle events

### Core Methods

#### spawn() (L40-51)
Public interface for spawning futures onto the thread pool. Delegates to `bind_new_task()` for actual implementation.

#### bind_new_task() (L58-79)
Core task binding logic:
- Creates task binding via `shared.owned.bind()` (L68)
- Invokes spawn hooks with task metadata (L70-74)
- Schedules the newly bound task without yielding (L76)
- Returns `JoinHandle` for task result access

#### shutdown() (L53-55)
Initiates runtime shutdown by calling internal `close()` method.

### Task Scheduling Implementation

#### Schedule trait impl (L82-100)
Implements `task::Schedule` trait for `Arc<Handle>`:
- `release()` (L83): Removes completed tasks from owned task set
- `schedule()` (L87): Standard task scheduling without yield flag
- `hooks()` (L91): Returns task termination callback hooks
- `yield_now()` (L97): Task scheduling with yield flag set

## Dependencies
- **worker module**: Multi-threaded worker pool management
- **driver module**: I/O event loop and resource drivers  
- **blocking module**: Blocking task thread pool
- **task module**: Task abstraction, metadata, and lifecycle management

## Architectural Patterns
- **Handle pattern**: Provides safe, clonable reference to runtime internals
- **Arc wrapper**: Enables shared ownership across multiple threads
- **Hook system**: Extensible callback mechanism for task lifecycle events
- **Conditional compilation**: Uses `cfg_unstable!` macro for experimental features (L102-110)

## Key Invariants
- Handle must be wrapped in `Arc` for thread-safe sharing
- Tasks must be `Send + 'static` for cross-thread execution
- All spawned tasks are tracked in the owned task set for proper cleanup
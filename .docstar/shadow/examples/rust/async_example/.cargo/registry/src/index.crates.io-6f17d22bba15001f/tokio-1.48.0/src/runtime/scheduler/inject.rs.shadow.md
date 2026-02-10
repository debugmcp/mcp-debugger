# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/inject.rs
@source-hash: 79aa8ba6e3204b10
@generated: 2026-02-09T18:03:09Z

## Purpose and Responsibility

This file implements an injection queue for Tokio's work-stealing task scheduler. The injection queue serves as a growable, MPMC (Multi-Producer, Multi-Consumer) queue that receives new tasks and handles overflow from local fixed-size worker queues.

## Key Components

### Inject<T> Struct (L23-26)
Primary queue implementation with two core fields:
- `shared: Shared<T>` - Lock-free shared state for the queue operations
- `synced: Mutex<Synced>` - Mutex-protected synchronized state for thread-safe coordination

### Core Methods

**new() (L29-36)**: Constructor that initializes both shared and synced components using `Shared::new()` factory method.

**close() (L47-50)**: Atomically closes the injection queue, preventing further task insertions. Returns boolean indicating if queue was open during transition.

**push() (L55-59)**: Thread-safe task insertion method that:
- Accepts `task::Notified<T>` instances
- Acquires synced lock before delegating to unsafe `shared.push()`
- Silently ignores pushes to closed queues

**pop() (L61-69)**: Thread-safe task extraction with optimization:
- Fast-path empty check via `shared.is_empty()` before locking
- Acquires synced lock only when potentially non-empty
- Delegates to unsafe `shared.pop()` for actual removal

**is_closed() (L39-43)**: Feature-gated method (taskdump) that checks queue closure status.

## Module Structure

The implementation is split across multiple submodules:
- `pop` - Pop operation logic (L6-7)
- `shared` - Lock-free shared queue state (L9-10) 
- `synced` - Synchronized state management (L12-13)
- `rt_multi_thread` - Multi-threaded runtime specific code (L15-17)
- `metrics` - Performance monitoring (L19)

## Dependencies and Relationships

- Uses `crate::loom::sync::Mutex` for cross-platform synchronization
- Operates on `task::Notified<T>` task types from `crate::runtime::task`
- Integrates with work-stealing scheduler as overflow mechanism

## Architectural Patterns

**Lock-Free + Lock Hybrid**: Combines lock-free operations (shared state) with mutex protection (synced state) for optimal performance while maintaining safety.

**Safety Abstractions**: All unsafe operations are encapsulated in the `shared` component, with this module providing safe interfaces through proper lock acquisition.

**Conditional Compilation**: Uses `cfg_rt_multi_thread!` macro and feature flags to conditionally include multi-threading and debugging functionality.
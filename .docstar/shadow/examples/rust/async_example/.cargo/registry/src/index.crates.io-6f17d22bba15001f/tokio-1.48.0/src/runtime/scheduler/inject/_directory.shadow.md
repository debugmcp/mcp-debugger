# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/inject/
@generated: 2026-02-09T18:16:04Z

## Purpose
This directory implements the **inject queue** component of Tokio's multi-threaded work-stealing scheduler. The inject queue serves as a global, thread-safe task distribution mechanism where tasks can be "injected" from any thread and later stolen by worker threads for execution.

## Architecture Overview
The inject queue uses a **two-layer architecture** combining lock-free operations with synchronized access:

### Core Components
- **`shared.rs`**: Lock-free shared state with atomic length tracking and core queue operations
- **`synced.rs`**: Synchronized linked-list data structure managing task head/tail pointers  
- **`pop.rs`**: Safe iterator abstraction for consuming tasks from the queue
- **`rt_multi_thread.rs`**: Multi-threaded runtime-specific batch operations
- **`metrics.rs`**: Introspection capabilities for runtime monitoring

### Data Flow
1. **Task Injection**: Tasks enter via `push()` or `push_batch()` operations that atomically update the linked list and length counter
2. **Task Consumption**: Workers pop tasks using the `Pop` iterator, which provides controlled iteration with length tracking
3. **Synchronization**: External locking coordinates access to the `Synced` state while atomic operations handle the shared length counter

## Public API Surface
- **Length Operations**: `len()`, `is_empty()` for queue introspection
- **Task Management**: `push()`, `push_batch()` for adding tasks; `pop()`, `pop_n()` for removal
- **Lifecycle**: `close()` for graceful shutdown, preventing new task additions
- **Metrics**: Queue length monitoring for runtime diagnostics

## Key Design Patterns

### Lock-Free Optimization
The shared length counter uses atomic operations to avoid locking on the hot path for empty queue checks, while actual queue manipulation is synchronized.

### Batch Operations
Optimized `push_batch()` operations reduce lock contention by chaining multiple tasks together before acquiring synchronization.

### Resource Safety
The `Pop` iterator implements `Drop` to ensure all remaining tasks are consumed, preventing task leakage during cleanup.

### Generic Task Handling
All operations are generic over `T: 'static` task types, using `task::Notified<T>` as the standard task representation.

## Integration Context
This inject queue is a critical component of Tokio's work-stealing scheduler, enabling efficient task distribution across multiple worker threads while maintaining thread safety and performance through careful synchronization design.
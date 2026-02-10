# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/inject/shared.rs
@source-hash: 4935d593a0d943d2
@generated: 2026-02-09T17:58:20Z

**Purpose**: Shared component of Tokio's task injection queue that manages atomic length tracking and provides thread-safe operations for the runtime scheduler. This is part of a lock-free task queue system used for work-stealing between worker threads.

**Core Structure**:
- `Shared<T>` (L9-15): Lock-free shared state containing atomic length counter and phantom data for generic task type
- `len`: AtomicUsize (L12) - Atomic counter tracking pending tasks to optimize hot path by avoiding unnecessary locking
- Manual Send/Sync implementations (L17-18) for thread safety

**Key Operations**:
- `new()` (L21-34): Factory method returning both Shared instance and synchronized Synced component with empty queue state
- `is_empty()` (L36-38): Fast check using atomic length counter
- `is_closed()` (L42-44): Conditional compilation for taskdump/multi-thread features, checks closure state
- `close()` (L48-55): Marks injection queue as closed, preventing new task additions
- `len()` (L57-59): Atomic load with Acquire ordering for length retrieval
- `push()` (L68-90): Unsafe method to add tasks to queue tail, updates linked list pointers and atomic counter
- `pop()` (L97-99): Single task removal, delegates to `pop_n()`
- `pop_n()` (L106-120): Batch task removal with atomic length adjustment, returns Pop iterator

**Safety Requirements**:
- All unsafe methods require same Synced instance from `new()` to maintain invariants
- Queue operations assume exclusive access through external synchronization
- Raw task pointer management requires careful lifetime handling

**Atomic Ordering**:
- Uses Acquire for reads (L58) and Release for writes (L89, L117) to establish happens-before relationships
- `unsync_load()` used when already synchronized externally (L74, L113)

**Dependencies**:
- Integrates with `super::{Pop, Synced}` for queue iteration and synchronization
- Uses `crate::runtime::task::Notified<T>` for task representation
- Leverages `crate::loom` for testing/verification support
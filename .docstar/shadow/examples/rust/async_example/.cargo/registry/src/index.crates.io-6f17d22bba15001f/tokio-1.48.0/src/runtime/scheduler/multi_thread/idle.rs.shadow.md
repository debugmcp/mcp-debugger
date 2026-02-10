# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/multi_thread/idle.rs
@source-hash: c2be2afa82ddbbe3
@generated: 2026-02-09T17:58:22Z

## Purpose
Coordinates idle worker management in Tokio's multi-threaded runtime scheduler. Tracks which workers are sleeping, searching for work, or unparked, enabling efficient work distribution and preventing excessive spinning.

## Key Components

### Idle Struct (L9-18)
Core coordinator containing:
- `state`: AtomicUsize tracking both searching and unparked worker counts via bit manipulation
- `num_workers`: Total worker pool size

### Synced Struct (L21-24)
Mutex-protected data containing:
- `sleepers`: Vec storing IDs of currently sleeping workers

### State Wrapper (L30-31)
Bit-packed state representation with methods for atomic operations on worker counts.

## Critical Bit Layout Constants (L26-28)
- `UNPARK_SHIFT`: 16-bit boundary separating unparked count (upper bits) from search count (lower bits)
- `UNPARK_MASK`/`SEARCH_MASK`: Bit masks for extracting respective counts

## Key Operations

### Worker Notification (L51-82)
`worker_to_notify()` implements double-checked locking pattern:
1. Fast path check if workers are searching (L61)
2. Lock acquisition and recheck (L66-70)  
3. Atomic increment and sleeper selection (L75-78)

### Worker State Transitions
- `transition_worker_to_parked()` (L86-102): Moves worker to sleep, decrements unparked count
- `transition_worker_to_searching()` (L104-115): Limits searchers to ~50% of worker pool
- `transition_worker_from_searching()` (L121-123): Returns whether caller must notify replacement

### Direct Worker Management
- `unpark_worker_by_id()` (L129-145): Removes specific worker from sleep set
- `is_parked()` (L148-151): Checks if worker is in sleep set

## State Management Methods (L159-209)
All atomic operations on the packed state:
- `num_searching()`/`num_unparked()`: Extract counts via bit masking
- `inc_num_searching()`/`dec_num_searching()`: Atomic search count updates
- `dec_num_unparked()`: Handles both unpark and search count decrements
- `unpark_one()`: Increments unparked count and optionally search count

## Architectural Patterns
- **Lock-free fast path**: Uses atomic operations for common checks before acquiring mutex
- **Double-checked locking**: Prevents race conditions in worker notification
- **Bit packing**: Efficiently stores two counters in single atomic value
- **Sequential consistency**: Uses SeqCst ordering for critical synchronization points (L58-60)

## Critical Invariants
- Search workers limited to ~50% of total workers to prevent excessive contention
- All state transitions maintain consistency between atomic counters and sleep set
- Worker notification only occurs when no searchers exist and workers are available
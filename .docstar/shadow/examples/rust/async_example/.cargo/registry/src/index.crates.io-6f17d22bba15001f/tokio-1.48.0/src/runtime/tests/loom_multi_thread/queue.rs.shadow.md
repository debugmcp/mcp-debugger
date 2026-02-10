# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/tests/loom_multi_thread/queue.rs
@source-hash: 54ae93457aaa96da
@generated: 2026-02-09T17:58:22Z

## Purpose
Loom-based concurrent tests for Tokio's multi-threaded work-stealing queue implementation. Tests task queue operations under various concurrency scenarios using deterministic concurrency testing.

## Key Functions

### `new_stats()` (L7-9)
Helper function that creates a new `Stats` instance for tracking queue metrics during tests.

### `basic()` (L11-63)
Core work-stealing test. Spawns a stealer thread that attempts to steal tasks from the main thread's queue. Main thread pushes 4 tasks total across 2 iterations, pops some locally. Tests basic steal/pop mechanics with expected total of 6 task operations.

### `steal_overflow()` (L65-113)  
Tests queue overflow behavior. Pushes 1 task initially, then 6 more tasks to trigger overflow into inject queue. Verifies stealer can access tasks and total count reaches 7.

### `multi_stealer()` (L115-167)
Tests multiple concurrent stealers competing for tasks from same queue. Creates 5 tasks, spawns 2 stealer threads, verifies all tasks are eventually consumed with no double-counting.

### `steal_tasks()` (L119-134)
Helper function for `multi_stealer` test. Attempts to steal into local queue and counts consumed tasks.

### `chained_steal()` (L169-205)
Complex scenario testing steal chains between multiple queues. Sets up 3 queues (l1, l2, stealer), loads tasks, tests stealing from one queue while another steals from it.

## Dependencies
- `queue` module from multi-thread scheduler for local/steal queue creation
- `unowned()` function for creating test tasks  
- `loom::thread` for deterministic concurrent testing
- `RefCell<Vec>` as inject queue for overflow tasks

## Architecture Patterns
- Uses Loom model-checking framework for deterministic concurrency testing
- Work-stealing queue pattern with local queues and steal handles
- Overflow mechanism redirects excess tasks to shared inject queue
- All tests verify exact task counts to ensure no loss/duplication

## Key Invariants
- Total task count must be preserved across all steal/pop operations
- Tasks can only be consumed once (no double-processing)
- Overflow tasks accumulate in inject queue when local queue is full
- Stealer threads operate independently without coordination
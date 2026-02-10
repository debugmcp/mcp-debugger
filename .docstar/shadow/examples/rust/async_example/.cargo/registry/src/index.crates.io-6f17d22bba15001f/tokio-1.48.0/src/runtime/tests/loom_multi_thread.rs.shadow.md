# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/tests/loom_multi_thread.rs
@source-hash: 28bde6e90c40467c
@generated: 2026-02-09T18:03:23Z

## Primary Purpose
Comprehensive loom-based concurrency testing for Tokio's multi-threaded runtime. Provides stress tests that explore race conditions and edge cases in task scheduling, blocking operations, and runtime shutdown scenarios.

## Key Components

### AtomicTake Utility (L25-58)
Thread-safe single-use container using `MaybeUninit` and atomic boolean for one-time value extraction:
- `new(value: T)` (L36-41): Initialize with value
- `take() -> Option<T>` (L43-50): Atomically extract value once using fetch_or
- Drop implementation (L53-57): Ensures cleanup if value not taken

### AtomicOneshot Wrapper (L60-74)
Cloneable wrapper around oneshot sender using AtomicTake for thread-safe access:
- `new(sender)` (L65-69): Creates shared oneshot sender
- `assert_send(value)` (L71-73): Sends value, panics if already consumed

### Test Groups

#### Group A (L77-163)
Core runtime behavior tests:
- `racy_shutdown` (L81-100): Tests worker dropping during block_in_place transition
- `pool_multi_spawn` (L103-133): Concurrent task spawning with atomic coordination
- `only_blocking_*` (L135-162): Block_in_place behavior with/without pending tasks

#### Group B (L165-289) 
Mixed workload and lifecycle tests:
- `blocking_and_regular_*` (L168-213): Combines blocking and regular tasks
- `join_output` (L216-227): Task output handling
- `poll_drop_handle_then_drop` (L230-244): Handle polling and dropping
- `complete_block_on_under_load` (L247-262): Runtime stress during block_on
- `shutdown_with_notification` (L265-288): Coordinated shutdown signaling

#### Group C (L291-310)
Pool shutdown behavior:
- `pool_shutdown` (L295-309): Runtime shutdown with concurrent gated tasks

#### Group D (L312-348)
Multi-notification scenarios:
- `pool_multi_notify` (L316-347): Concurrent notification handling

### Utility Functions

#### Runtime Creation (L350-357)
`mk_pool(num_threads)`: Creates configured multi-threaded runtime with fixed event intervals

#### Test Futures
- `gated2(thread: bool)` (L359-394): Creates future that waits for external wake signal
- `multi_gated()` (L396-426): Future with multi-stage atomic waker coordination
- `track<T>(f: T)` (L428-433): Wraps futures with Arc for leak tracking

#### Track Wrapper (L435-461)
Pin-projected future wrapper that:
- Maintains Arc reference for loom leak detection
- Preserves future output in Track container
- Implements Future trait with proper pinning

## Architecture Patterns
- Uses loom for deterministic concurrency testing with model checking
- Employs atomic coordination patterns for race condition testing
- Separates test concerns into focused groups for CI efficiency
- Leverages oneshot channels for synchronization points
- Implements comprehensive future tracking for resource leak detection

## Critical Invariants
- All spawned tasks must be properly tracked to avoid loom leak detection
- Atomic operations use SeqCst ordering for strongest consistency guarantees
- Test scenarios exercise specific interleavings that could cause runtime issues
- Runtime configuration uses fixed intervals to avoid tuning-related non-determinism
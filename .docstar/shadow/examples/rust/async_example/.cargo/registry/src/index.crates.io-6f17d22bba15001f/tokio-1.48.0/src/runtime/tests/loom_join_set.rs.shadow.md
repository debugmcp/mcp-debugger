# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/tests/loom_join_set.rs
@source-hash: d6612a19c695907a
@generated: 2026-02-09T18:03:14Z

## Purpose
Loom-based concurrency tests for Tokio's JoinSet functionality. Uses Loom's model checker to explore all possible interleavings and verify correctness of concurrent JoinSet operations under race conditions.

## Dependencies
- `crate::runtime::Builder` - Tokio runtime builder for test environment setup
- `crate::task::JoinSet` - Primary component under test
- `loom::model` - Concurrency model checker for exhaustive testing
- `std::sync::{atomic::AtomicBool, Arc}` - Synchronization primitives for cross-execution state tracking

## Key Test Functions

### `test_join_set()` (L4-34)
Basic correctness test verifying JoinSet length tracking and task completion semantics:
- Creates single-threaded runtime with `Builder::new_multi_thread().worker_threads(1)` (L7-10)
- Tests spawn/join cycle: spawn 2 tasks, join 1, spawn 1 more, join remaining (L13-29)
- Verifies `len()` accuracy after each operation
- Tests proper cleanup with explicit drops (L31-32)

### `abort_all_during_completion()` (L36-82)
Race condition test for `abort_all()` vs task completion timing:
- Uses shared `AtomicBool` flags to track execution outcomes across model runs (L45-46)
- Spawns task then immediately calls `abort_all()` (L60-61)
- Verifies both completion and cancellation paths are exercised (L63-70)
- Ensures `join_next()` returns `None` after processing aborted task (L72)
- Post-model assertions confirm both race outcomes occurred (L80-81)

## Testing Patterns
- **Loom model checking**: Each test wrapped in `loom::model(|| {...})` for exhaustive concurrency exploration
- **Single-worker runtime**: Uses 1 worker thread to create deterministic scheduling scenarios
- **Length invariant testing**: Consistent verification of `JoinSet::len()` after operations
- **Race condition validation**: Explicit verification that all possible execution interleavings occur

## Critical Invariants
- JoinSet length accurately reflects spawned vs completed tasks
- Aborted tasks still appear in `join_next()` results before removal
- Both task completion and cancellation outcomes must be observable in abort scenarios
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/sync_mutex.rs
@source-hash: cf247ed37c1c68e8
@generated: 2026-02-09T18:12:32Z

**Test Suite for Tokio Async Mutex (`tokio::sync::Mutex`)**

This file comprehensively tests the asynchronous mutex implementation in Tokio, focusing on locking behavior, fairness, abort handling, and debugging features.

## Key Test Categories

### Basic Locking Tests
- **`straight_execution` (L19-39)**: Validates sequential lock acquisition and modification of protected data
- **`readiness` (L42-57)**: Tests lock contention using `Arc<Mutex>` shared between tasks, verifying that pending tasks are properly woken when lock is released
- **`try_lock` (L152-162)**: Tests non-blocking lock attempts, ensuring proper success/failure behavior

### Abort Safety Tests  
- **`aborted_future_1` (L95-119)**: Critical test ensuring mutex unlocks when future holding lock is aborted via timeout
- **`aborted_future_2` (L125-149)**: Tests abort behavior when future is waiting for lock (not holding it)

### Debug Implementation Tests
- **`debug_format` (L165-169)**: Verifies Debug formatting of mutex guard contents
- **`mutex_debug` (L172-178)**: Tests mutex Debug output in locked vs unlocked states

## Architecture & Dependencies

**Key Imports:**
- `tokio::sync::Mutex` - Core async mutex type
- `tokio_test::{assert_pending, assert_ready, spawn}` - Test utilities for async task polling
- Cross-platform test macros handling WASM vs native environments (L4-10)

**Testing Patterns:**
- Uses `spawn()` to create pollable task handles for fine-grained async control
- Employs `Arc` for shared ownership in contention tests
- Abort safety tested via `tokio::time::timeout` with short durations

## Critical Invariants
1. Mutex must unlock when guard is dropped, even if future is aborted
2. Waiting tasks must be properly woken when lock becomes available
3. Non-blocking `try_lock()` must fail immediately when lock is held
4. Debug representation must indicate lock state accurately

## Code Quality Issues
Contains a large commented-out test block (L59-89) that appears to be legacy code using deprecated MockTask patterns.
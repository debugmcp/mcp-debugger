# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/sync_panic.rs
@source-hash: 3f3cde0f82264f81
@generated: 2026-02-09T18:12:31Z

## Purpose

Test file that verifies correct panic location reporting for Tokio's synchronization primitives when used incorrectly. Ensures that panics from blocking operations called inside async contexts point to the correct file location in user code.

## Key Components

### Configuration (L1-3)
- Only runs on full Tokio feature with unwind panic strategy
- Excludes WASI targets

### Dependencies (L5-14)
- Uses `test_panic` helper from local `support::panic` module
- Tests broadcast, mpsc, oneshot channels, Mutex, RwLock, and Semaphore

### Test Functions

**Channel Construction Tests:**
- `broadcast_channel_panic_caller()` (L16-26): Tests broadcast channel with invalid capacity (0)
- `mpsc_bounded_channel_panic_caller()` (L105-114): Tests bounded mpsc channel with invalid capacity (0)

**Blocking Operation Tests:**
- `mutex_blocking_lock_panic_caller()` (L28-42): Tests Mutex::blocking_lock() in async context
- `oneshot_blocking_recv_panic_caller()` (L44-58): Tests oneshot receiver blocking_recv() in async context
- `rwlock_blocking_read_panic_caller()` (L72-86): Tests RwLock::blocking_read() in async context
- `rwlock_blocking_write_panic_caller()` (L88-102): Tests RwLock::blocking_write() in async context
- Multiple mpsc blocking operation tests (L117-195): Tests blocking_recv(), blocking_recv_many(), blocking_send() for bounded and unbounded channels

**Configuration Tests:**
- `rwlock_with_max_readers_panic_caller()` (L60-70): Tests RwLock with invalid max_readers parameter

**Semaphore Permit Tests:**
- `semaphore_merge_unrelated_owned_permits()` (L197-211): Tests merging permits from different owned semaphores
- `semaphore_merge_unrelated_permits()` (L213-227): Tests merging permits from different borrowed semaphores

### Utility Function

**`current_thread()` (L229-231):**
- Creates single-threaded Tokio runtime with all features enabled
- Used by tests that need to run blocking operations in async context

## Test Pattern

Each test follows the same pattern:
1. Use `test_panic()` to capture panic location
2. Trigger panic condition with Tokio sync primitive
3. Assert panic occurred in this test file using `file!()` macro

## Critical Behavior

Tests verify that panic locations are correctly attributed to user code rather than internal Tokio implementation details, which is crucial for debugging experience.
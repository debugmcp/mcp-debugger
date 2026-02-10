# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/tests/loom_local.rs
@source-hash: df689c716bcb5acc
@generated: 2026-02-09T18:03:14Z

## Purpose
Test module verifying memory leak prevention in Tokio's `LocalSet` runtime during concurrent wakeup operations at shutdown using Loom's concurrency testing framework.

## Key Components

### Test Function: `wake_during_shutdown` (L15-47)
- **Purpose**: Validates that tasks don't leak when wakers are triggered during `LocalSet` shutdown
- **Testing Strategy**: Uses Loom's model checker to explore concurrent execution paths
- **Memory Safety**: Relies on Loom's leak finder to detect reference cycles or lingering tasks

### Test Architecture
1. **Runtime Setup** (L18-19): Creates single-threaded Tokio runtime with `LocalSet`
2. **Communication Channel** (L21): Uses custom oneshot channel from `loom_oneshot` module
3. **Local Task Spawn** (L23-34): Spawns task that:
   - Extracts waker from polling context (L28)
   - Sends waker through oneshot channel 
   - Remains perpetually pending (L31)
4. **Concurrent Waker Thread** (L36-39): Separate thread receives and triggers waker
5. **Controlled Shutdown** (L41-45): Executes minimal work, then drops `LocalSet` before joining waker thread

## Dependencies
- `crate::runtime::tests::loom_oneshot`: Custom oneshot channel implementation for Loom testing
- `crate::runtime::Builder`: Tokio runtime builder
- `crate::task::LocalSet`: Local task set for single-threaded async execution
- `loom`: Concurrency testing framework for model checking

## Critical Invariants
- **Memory Safety**: No tasks should remain in notification queues after `LocalSet` drop
- **Shutdown Ordering**: `LocalSet` must be dropped before joining the waker thread to test the race condition
- **Waker Lifecycle**: Waker must be triggered after `LocalSet` begins shutdown but before runtime drop

## Testing Pattern
This follows a "shutdown race condition" testing pattern where:
1. A task registers for wakeup notification
2. Shutdown begins while waker is held externally  
3. External thread triggers waker during shutdown window
4. Test verifies no memory leaks occur from this timing

The test specifically targets the scenario described in the documentation comment (L7-10) where runtime notification queues could retain task references causing memory leaks.
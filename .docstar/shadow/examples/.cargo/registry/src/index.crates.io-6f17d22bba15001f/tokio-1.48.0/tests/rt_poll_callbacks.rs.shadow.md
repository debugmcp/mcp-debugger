# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/rt_poll_callbacks.rs
@source-hash: f3031ee5b56ea6af
@generated: 2026-02-09T18:12:28Z

## Purpose
Test suite validating Tokio's runtime polling callbacks functionality. Tests the `on_before_task_poll` and `on_after_task_poll` hooks that fire during task execution lifecycle, requiring the `tokio_unstable` feature flag.

## Key Test Functions

### `callbacks_fire_multi_thread` (L9-72)
- **Platform Restriction**: Excluded on WASI targets (L8)  
- **Runtime Type**: Multi-threaded Tokio runtime (L23-24)
- **Test Pattern**: Creates runtime with polling callbacks that increment atomic counters and capture task IDs
- **Task Execution**: Spawns task with 3 `yield_now()` calls to force multiple polling cycles (L41-45)
- **Assertions**: Verifies 4 poll start/stop events and correct task ID capture (L53-71)

### `callbacks_fire_current_thread` (L74-128)
- **Runtime Type**: Current-thread Tokio runtime (L88-89)
- **Test Pattern**: Nearly identical to multi-thread test but uses single-threaded runtime
- **Key Difference**: Simplified result handling (`let _ = rt.block_on(task)` vs explicit `expect()`) (L115)
- **Expected Count**: Hardcoded assertion of 4 events (L126-127)

## Core Components

**Callback Infrastructure**:
- Atomic counters for poll start/stop tracking (L11-12, L76-77)
- Mutex-wrapped task ID storage for callback validation (L16-19, L81-84)
- Arc cloning for callback closure capture (L21-22, L86-87)

**Runtime Configuration**:
- `.on_before_task_poll()` and `.on_after_task_poll()` hooks (L25-38, L90-103)
- Callbacks capture `task_meta.id()` and increment counters atomically
- `.enable_all()` enables all Tokio features (L24, L89)

## Critical Invariants
- Each `yield_now()` triggers exactly one poll cycle
- 3 yield calls + initial poll = 4 total polling events
- Task IDs must match between callbacks and spawned task
- Runtime must be explicitly dropped to ensure worker thread cleanup (L51, L116)

## Dependencies
- `tokio::task::yield_now` for controlled task yielding
- `std::sync::{Arc, Mutex, atomic::AtomicUsize}` for thread-safe state sharing
- Requires `tokio_unstable` feature for callback APIs (L2)
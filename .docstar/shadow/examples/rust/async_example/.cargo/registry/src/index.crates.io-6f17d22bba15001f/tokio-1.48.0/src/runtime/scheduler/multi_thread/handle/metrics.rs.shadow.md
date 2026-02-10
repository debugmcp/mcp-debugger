# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/multi_thread/handle/metrics.rs
@source-hash: b7985cf9e5c07ff3
@generated: 2026-02-09T17:57:17Z

## Purpose
Extends the multi-threaded runtime Handle with metrics collection methods. Provides runtime introspection capabilities for monitoring task scheduling, worker thread status, and queue depths across the Tokio multi-threaded scheduler.

## Key Implementation

**Handle Extension (L8-55)**
- Implements metrics methods on the multi-threaded scheduler Handle
- Provides both stable and unstable metrics depending on feature flags

**Core Metrics Methods (L9-23)**
- `num_workers()` (L9-11): Returns worker thread count from shared metrics array
- `num_alive_tasks()` (L13-15): Delegates to shared owned task counter
- `injection_queue_depth()` (L17-19): Returns depth of global task injection queue
- `worker_metrics()` (L21-23): Returns reference to specific worker's metrics by index

**Unstable Metrics (L25-54)**
Conditionally compiled methods behind `cfg_unstable_metrics`:
- `spawned_tasks_count()` (L27-29): 64-bit task spawn counter (64-bit platforms only)
- `num_blocking_threads()` (L32-37): Calculates blocking threads by subtracting workers from total
- `num_idle_blocking_threads()` (L39-41): Returns idle blocking thread count
- `scheduler_metrics()` (L43-45): Returns reference to scheduler-wide metrics
- `worker_local_queue_depth()` (L47-49): Returns specific worker's local queue depth
- `blocking_queue_depth()` (L51-53): Returns blocking task queue depth

## Dependencies
- `super::Handle`: The multi-threaded scheduler handle type
- `crate::runtime::WorkerMetrics`: Per-worker metrics structure
- `crate::runtime::SchedulerMetrics`: Scheduler-wide metrics (unstable only)

## Architecture Notes
- Uses conditional compilation (`cfg_unstable_metrics`, `cfg_64bit_metrics`) to gate experimental features
- All methods are `pub(crate)` - internal to the crate but accessible across modules
- Metrics are read-only views into shared runtime state
- Comment on L33 explains blocking spawner architecture detail
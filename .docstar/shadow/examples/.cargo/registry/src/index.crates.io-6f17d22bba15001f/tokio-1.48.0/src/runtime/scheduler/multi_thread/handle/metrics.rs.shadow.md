# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/multi_thread/handle/metrics.rs
@source-hash: b7985cf9e5c07ff3
@generated: 2026-02-09T18:02:15Z

## Purpose
Provides metrics collection methods for the multi-threaded runtime scheduler handle. Implements observability APIs to monitor runtime state including worker threads, task queues, and blocking operations.

## Key Implementation
**Handle impl block (L8-55)** - Extends the scheduler Handle with metrics methods:

### Core Metrics (Always Available)
- `num_workers()` (L9-11) - Returns count of worker threads from shared worker_metrics array
- `num_alive_tasks()` (L13-15) - Delegates to shared.owned for active task count  
- `injection_queue_depth()` (L17-19) - Gets global injection queue depth via shared reference
- `worker_metrics()` (L21-23) - Returns reference to WorkerMetrics for specific worker by index

### Unstable Metrics (cfg_unstable_metrics)
- `spawned_tasks_count()` (L27-29) - 64-bit counter of total spawned tasks (cfg_64bit_metrics)
- `num_blocking_threads()` (L32-37) - Calculates blocking threads by subtracting workers from total spawner threads
- `num_idle_blocking_threads()` (L39-41) - Direct delegation to blocking_spawner
- `scheduler_metrics()` (L43-45) - Returns reference to SchedulerMetrics from shared state
- `worker_local_queue_depth()` (L47-49) - Gets local queue depth for specific worker
- `blocking_queue_depth()` (L51-53) - Returns blocking operation queue depth

## Dependencies
- `super::Handle` - The Handle type being extended
- `crate::runtime::WorkerMetrics` - Worker-specific metrics type
- `crate::runtime::SchedulerMetrics` - Scheduler-wide metrics (unstable only)

## Architecture Notes
- All methods are `pub(crate)` indicating internal runtime API
- Heavy use of conditional compilation for feature gating unstable metrics
- Methods primarily delegate to shared runtime state rather than maintaining local state
- Blocking thread calculation uses saturating subtraction to prevent underflow
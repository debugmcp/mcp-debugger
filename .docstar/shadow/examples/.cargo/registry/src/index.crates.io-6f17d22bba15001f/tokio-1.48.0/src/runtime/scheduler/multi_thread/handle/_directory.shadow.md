# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/multi_thread/handle/
@generated: 2026-02-09T18:16:03Z

## Purpose
This directory implements the public API extensions for the multi-threaded runtime scheduler handle, providing observability and diagnostic capabilities. It extends the base `Handle` type with methods for metrics collection and runtime state inspection.

## Key Components

### metrics.rs
Implements comprehensive metrics collection APIs for monitoring runtime performance and state:
- **Core metrics**: Worker count, active tasks, queue depths - always available
- **Unstable metrics**: Advanced observability features like task spawn counts, blocking thread metrics, and detailed scheduler state (feature-gated)

### taskdump.rs  
Provides diagnostic capabilities for capturing complete runtime state:
- **Task dump functionality**: Async coordination with worker threads to collect task information
- **Trace coordination**: Implements exclusive access pattern to serialize dump operations

## Public API Surface
The module extends `Handle` with these key entry points:

**Always Available Metrics**:
- `num_workers()` - Worker thread count
- `num_alive_tasks()` - Active task count  
- `injection_queue_depth()` - Global queue depth
- `worker_metrics(index)` - Per-worker metrics

**Diagnostic Operations**:
- `dump()` - Async task dump collection

**Unstable Metrics** (cfg_unstable_metrics):
- `spawned_tasks_count()` - Total spawned tasks
- `num_blocking_threads()` / `num_idle_blocking_threads()` - Blocking pool state
- `scheduler_metrics()` - Scheduler-wide metrics
- `worker_local_queue_depth(index)` - Per-worker local queue depth
- `blocking_queue_depth()` - Blocking operation queue depth

## Internal Organization
- All methods are `pub(crate)` scope, indicating internal runtime API
- Heavy delegation pattern to shared runtime state rather than local state maintenance
- Conditional compilation extensively used for feature gating unstable APIs
- Notification-based coordination for async operations requiring worker thread participation

## Data Flow
1. **Metrics collection**: Direct delegation to shared runtime components (worker_metrics, shared state)
2. **Task dumps**: Async coordination flow using trace status locks and worker notifications
3. **State access**: Read-only access patterns to runtime internals for observability

## Important Patterns
- **Feature gating**: Extensive use of `cfg_unstable_metrics` to control API surface
- **Async coordination**: Notification-based synchronization for operations requiring worker participation  
- **Defensive programming**: Saturating arithmetic to prevent underflow in calculations
- **Exclusive access**: Trace status mechanism ensures serialized diagnostic operations
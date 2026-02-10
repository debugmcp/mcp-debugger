# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/multi_thread/handle/
@generated: 2026-02-09T18:16:09Z

## Purpose
Provides runtime introspection and diagnostic capabilities for Tokio's multi-threaded scheduler handle. This module extends the core scheduler handle with methods for accessing metrics, performance data, and runtime state information.

## Key Components

### Metrics Collection (`metrics.rs`)
- Implements metrics methods on the multi-threaded scheduler Handle
- Provides read-only access to runtime performance data including worker counts, task counters, and queue depths
- Supports both stable metrics (always available) and unstable metrics (feature-gated experimental data)
- Offers per-worker granular metrics and scheduler-wide aggregate data

### Task Dumping (`taskdump.rs`)
- Implements asynchronous task state dumping functionality
- Provides runtime diagnostic snapshots through the `dump()` method
- Uses coordination mechanisms to ensure thread-safe, non-concurrent dump operations

## Public API Surface

### Stable Metrics Methods
- `num_workers()`: Returns active worker thread count
- `num_alive_tasks()`: Returns current live task count
- `injection_queue_depth()`: Returns global task queue depth
- `worker_metrics(index)`: Returns metrics for specific worker thread

### Unstable Metrics (Feature-Gated)
- `spawned_tasks_count()`: 64-bit task spawn counter
- `num_blocking_threads()`: Calculated blocking thread count
- `scheduler_metrics()`: Scheduler-wide performance data
- `worker_local_queue_depth()`: Per-worker queue depth
- `blocking_queue_depth()`: Blocking task queue depth

### Diagnostics
- `dump()`: Asynchronous method returning comprehensive runtime state snapshot

## Internal Organization

### Data Flow
1. **Metrics Collection**: Handle methods read from shared metrics structures maintained by worker threads
2. **Task Dumping**: Coordinated process where handle requests data from all workers and aggregates results
3. **Synchronization**: Uses notification-based coordination to ensure thread-safe access to runtime state

## Architecture Patterns
- **Extension Pattern**: Both modules extend the base Handle with additional capabilities
- **Observer Pattern**: Provides read-only views into runtime state without affecting scheduler operation
- **Coordination Pattern**: Task dumping uses mutual exclusion and worker notification to ensure data consistency
- **Feature Gating**: Uses conditional compilation to separate stable from experimental functionality

## Integration Points
- Integrates with core multi-threaded scheduler Handle type
- Accesses shared worker metrics arrays and task counters
- Coordinates with worker threads for comprehensive state capture
- Provides internal crate visibility (`pub(crate)`) for cross-module access

This module serves as the primary interface for runtime observability, enabling applications and tooling to monitor and diagnose Tokio multi-threaded scheduler performance and behavior.
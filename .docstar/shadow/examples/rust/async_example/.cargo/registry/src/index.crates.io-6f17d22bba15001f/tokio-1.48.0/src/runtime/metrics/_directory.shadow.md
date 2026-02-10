# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/metrics/
@generated: 2026-02-09T18:16:43Z

## Purpose and Responsibility

The `runtime/metrics` module provides comprehensive observability infrastructure for Tokio's async runtime, enabling detailed performance monitoring, debugging, and introspection. It implements a hierarchical metrics collection system that tracks runtime behavior across multiple dimensions: task scheduling, worker thread performance, I/O operations, and timing distributions.

## Core Architecture

The module implements a **batch-then-submit** pattern to minimize atomic contention during high-frequency metric collection:

1. **Local Collection**: `MetricsBatch` accumulates metrics locally on each worker thread
2. **Periodic Submission**: Batched metrics are periodically flushed to atomic counters in `WorkerMetrics`
3. **Public API**: `RuntimeMetrics` provides the primary consumer interface for accessing aggregated data

## Key Components and Integration

### Metrics Infrastructure
- **RuntimeMetrics**: Main public API handle providing access to all runtime performance data
- **WorkerMetrics**: Per-worker atomic storage for thread-specific performance counters (busy time, park events, task counts)
- **MetricsBatch**: Thread-local accumulator that batches metric updates before atomic submission
- **SchedulerMetrics**: Cross-thread task scheduling and budget exhaustion tracking
- **IoDriverMetrics**: File descriptor lifecycle and I/O readiness event monitoring (requires `net` feature)

### Histogram System
- **LogHistogram**: H2-algorithm based histogram for duration distribution measurement with bounded error guarantees
- **HistogramBuilder/HistogramBatch**: Configuration and batched collection for timing data
- **Multiple Histogram Types**: Support for linear, legacy logarithmic, and modern H2 bucketing strategies

### Conditional Compilation Strategy
The module uses extensive feature-gating to balance performance and functionality:
- **Stable vs Unstable**: Basic counters always available; advanced metrics require `tokio_unstable`
- **Platform-specific**: 64-bit metrics only available on 64-bit platforms
- **Feature-gated**: I/O metrics require `net` feature; mock implementations when metrics disabled
- **Mock Fallbacks**: No-op implementations maintain API compatibility when metrics are disabled

## Public API Surface

### Primary Entry Points
- `Runtime::metrics()` → `RuntimeMetrics` - Main metrics handle (cloneable, thread-safe)
- `RuntimeMetrics::num_workers()` - Basic runtime configuration
- `RuntimeMetrics::num_alive_tasks()` - Active task count
- `RuntimeMetrics::worker_*()` methods - Per-worker performance data

### Advanced Observability (Unstable Features)
- **Task Lifecycle**: Spawn counts, scheduling patterns, poll frequencies
- **Work Distribution**: Task stealing statistics, queue depths, overflow events  
- **Timing Analysis**: Poll duration histograms with configurable precision
- **I/O Monitoring**: File descriptor registration/deregistration, readiness events
- **Blocking Pool**: Blocking thread utilization and queue depths

## Internal Organization and Data Flow

```
User Code → RuntimeMetrics (public API)
              ↓
         Handle::inner (runtime core)
              ↓
    WorkerMetrics[] (per-worker atomics)
         ↑
MetricsBatch (thread-local accumulation)
         ↑
   Individual operations (task polls, parks, etc.)
```

The metrics flow from individual runtime operations through thread-local batches to atomic storage, finally exposed through the public `RuntimeMetrics` API. This design minimizes performance overhead during normal runtime operation while providing comprehensive observability when needed.

## Important Patterns and Conventions

- **Monotonic Counters**: All metrics are cumulative and never decrease, simplifying reasoning about trends
- **Relaxed Atomics**: Uses `Relaxed` memory ordering for performance, as exact metric ordering is non-critical
- **Cache-line Alignment**: Worker metrics are 128-byte aligned to prevent false sharing
- **Error Bound Management**: Histogram precision parameter balances memory usage vs measurement accuracy
- **Platform Abstraction**: Conditional time handling for WASM compatibility

This module serves as the foundation for Tokio's runtime introspection capabilities, enabling performance profiling, debugging, and production monitoring of async applications.
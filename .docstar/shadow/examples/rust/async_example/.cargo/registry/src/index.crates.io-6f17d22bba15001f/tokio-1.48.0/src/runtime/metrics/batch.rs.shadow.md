# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/metrics/batch.rs
@source-hash: d7b1fcb0037c50d8
@generated: 2026-02-09T18:03:08Z

## Purpose
Batch accumulator for Tokio runtime worker thread metrics. Provides local metric collection that periodically submits to global worker metrics to reduce atomic contention. Supports both stable and unstable metric variants through conditional compilation.

## Core Structure
- **MetricsBatch (L10-56)**: Main accumulator containing worker performance counters
  - `busy_duration_total` (L12): Total time spent processing tasks
  - `park_count`/`park_unpark_count` (L18,21): Thread parking/unparking statistics
  - Unstable fields (L23-55): Extended metrics for task stealing, polling, scheduling

- **PollTimer (L59-65)**: Unstable-only helper for tracking task poll time histograms

## Key Methods
- **new() (L69-72)** / **new_unstable() (L77,88)**: Constructor with stable/unstable variants
- **submit() (L116-122)** / **submit_unstable() (L127,136)**: Flush accumulated metrics to worker atomics
- **about_to_park() (L165,172)**: Track parking events, noop detection in unstable variant
- **unparked() (L187)**: Increment unpark counter
- **start/end_processing_scheduled_tasks() (L192,197)**: Track task batch processing duration
- **start/end_poll() (L209,213,225,229)**: Track individual task poll times (unstable only)
- **inc_local_schedule_count() (L240,243)**: Count locally scheduled tasks

## Multi-threaded Extensions (L250-285)
- **incr_steal_count() (L254,257)**: Count stolen tasks
- **incr_steal_operations() (L265,268)**: Count steal attempts  
- **incr_overflow_count() (L276,279)**: Count local queue overflows

## Utilities
- **duration_as_u64() (L287)**: Safe duration to nanoseconds conversion with overflow protection
- **now() (L293)**: Platform-aware instant creation (returns None on WASM)

## Architecture Patterns
- Dual stable/unstable variants using `cfg_metrics_variant!` macro
- Batch accumulation pattern to minimize atomic operations
- Platform-specific time handling for WASM compatibility
- Zero-cost abstractions for disabled metrics (no-op implementations)

## Dependencies
- `WorkerMetrics` for atomic storage
- `HistogramBatch` for poll time distribution tracking (unstable)
- Standard library atomics and time types
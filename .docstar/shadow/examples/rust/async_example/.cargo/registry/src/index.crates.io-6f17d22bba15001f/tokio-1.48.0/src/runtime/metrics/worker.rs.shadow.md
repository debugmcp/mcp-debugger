# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/metrics/worker.rs
@source-hash: a88598f939349959
@generated: 2026-02-09T18:03:08Z

## Purpose
Defines metrics collection infrastructure for individual Tokio runtime workers, tracking performance and behavior statistics for debugging and monitoring purposes.

## Key Components

### WorkerMetrics struct (L18-68)
Cache-aligned (128 bytes) metrics container with atomic counters tracking worker thread performance:

**Core metrics (always available):**
- `busy_duration_total` (L22): Total time spent executing tasks vs parking
- `queue_depth` (L26): Current local task queue size (current-thread scheduler only)
- `thread_id` (L29): Protected worker thread identifier
- `park_count` (L32): Worker parking events counter
- `park_unpark_count` (L35): Complete park/unpark cycle counter

**Unstable metrics (tokio_unstable feature):**
- `noop_count` (L39): Spurious wake-ups without work
- `steal_count` (L43): Tasks stolen from other workers
- `steal_operations` (L47): Work-stealing attempt counter
- `poll_count` (L51): Total task polls executed
- `mean_poll_time` (L55): EWMA of task poll duration (nanoseconds)
- `local_schedule_count` (L59): Local queue task scheduling events
- `overflow_count` (L63): Tasks moved to global queue due to local overflow
- `poll_count_histogram` (L67): Optional poll duration histogram

### Key Methods

**Core functionality:**
- `new()` (L71-73): Default constructor
- `set_queue_depth()` (L75-77): Updates current queue depth atomically
- `set_thread_id()` (L79-81): Thread-safe thread ID assignment

**Configuration-aware construction:**
- `from_config()` (L85-98): Conditional compilation creates stable vs unstable variants
  - Stable: Basic metrics only
  - Unstable: Includes histogram configuration from runtime Config

**Metrics access (unstable only):**
- `queue_depth()` (L102-104): Atomic queue depth read
- `thread_id()` (L106-108): Thread-safe thread ID retrieval

## Dependencies
- `MetricAtomicU64/MetricAtomicUsize`: Lock-free atomic counters for metrics
- `Config`: Runtime configuration for histogram setup
- `Histogram`: Poll duration tracking (unstable feature)

## Architectural Notes
- 128-byte alignment prevents false sharing between worker metrics
- Conditional compilation separates stable/unstable metric sets
- All counters use relaxed atomic ordering for performance
- Thread ID uses mutex protection despite being write-once for safety
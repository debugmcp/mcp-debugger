# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/multi_thread/stats.rs
@source-hash: dd139fdc97d16b42
@generated: 2026-02-09T17:58:20Z

## Purpose
Per-worker statistics collection and performance tuning for Tokio's multi-threaded scheduler. Wraps MetricsBatch for user-facing metrics while adding adaptive global queue interval tuning based on exponentially-weighted moving average (EWMA) of task poll times.

## Key Components

### Stats Struct (L7-27)
Core statistics container with four fields:
- `batch: MetricsBatch` (L10) - Handles user-facing runtime metrics
- `processing_scheduled_tasks_started_at: Instant` (L16) - Tracks batch processing start time
- `tasks_polled_in_batch: usize` (L19) - Counts tasks in current batch
- `task_poll_time_ewma: f64` (L26) - Running average of task poll duration in nanoseconds

### Tuning Constants (L29-39)
- `TASK_POLL_TIME_EWMA_ALPHA: f64 = 0.1` (L30) - EWMA smoothing factor
- `TARGET_GLOBAL_QUEUE_INTERVAL: f64` (L33) - 200μs target interval
- `MAX_TASKS_POLLED_PER_GLOBAL_QUEUE_INTERVAL: u32 = 127` (L36) - Upper bound
- `TARGET_TASKS_POLLED_PER_GLOBAL_QUEUE_INTERVAL: u32 = 61` (L39) - Default target

### Key Methods

#### Constructor (L42-53)
`new()` initializes with seeded EWMA value using target interval divided by target tasks per interval.

#### Adaptive Tuning (L55-67)
`tuned_global_queue_interval()` calculates optimal task count before checking global queue:
- Returns configured value if explicitly set
- Otherwise computes `TARGET_GLOBAL_QUEUE_INTERVAL / task_poll_time_ewma`
- Clamps result between 2 and MAX_TASKS_POLLED_PER_GLOBAL_QUEUE_INTERVAL

#### Batch Processing (L85-114)
- `start_processing_scheduled_tasks()` (L85-90) resets batch state
- `end_processing_scheduled_tasks()` (L92-114) updates EWMA using weighted alpha calculation:
  - Computes mean poll duration for batch
  - Applies `weighted_alpha = 1.0 - (1.0 - α)^num_polls` formula
  - Updates EWMA: `new_ewma = weighted_alpha * mean + (1 - weighted_alpha) * old_ewma`

#### Task Tracking (L116-124)
- `start_poll()` increments batch counter and delegates to MetricsBatch
- `end_poll()` delegates to MetricsBatch

#### Metric Delegation (L69-136)
Most methods (`submit`, `about_to_park`, `unparked`, etc.) forward calls to the wrapped MetricsBatch.

## Architecture Notes
- Duplicates timing data between Stats and MetricsBatch for future unification
- Uses saturating f64→u32 casts (Rust 1.45+ behavior)
- Weighted alpha calculation accounts for batch size in EWMA updates
- Self-tuning avoids returning values < 2 to prevent constant global queue checking
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/rt_metrics.rs
@source-hash: da050ef35f48e061
@generated: 2026-02-09T18:12:29Z

## Purpose
Test suite for Tokio runtime metrics API, validating metric collection accuracy across single-threaded and multi-threaded runtime configurations on platforms with 64-bit atomic support.

## Key Test Functions

### Worker Metrics Tests
- `num_workers()` (L10-16): Validates worker count reporting (1 for current_thread, 2 for threaded)
- `num_alive_tasks()` (L19-48): Tests task lifecycle tracking with race condition handling for multi-threaded runtimes
- `worker_total_busy_duration()` (L87-127): Measures worker busy time accumulation through task execution
- `worker_park_count()` (L130-147): Validates worker parking events during async sleep operations  
- `worker_park_unpark_count()` (L150-185): Tests park/unpark cycle counting with runtime lifecycle events

### Queue Depth Tests
- `global_queue_depth_current_thread()` (L51-65): Tests global queue depth tracking for single-threaded runtime
- `global_queue_depth_multi_thread()` (L68-84): Tests queue depth with worker blocking strategy, includes retry logic for race conditions

## Helper Functions
- `try_block_threaded()` (L187-218): Blocks all runtime workers using mpsc channels to create deterministic test conditions. Returns channel senders as task handles or timeout error.
- `current_thread()` (L220-225): Factory for single-threaded runtime with all features enabled
- `threaded()` (L227-233): Factory for 2-worker multi-threaded runtime with all features enabled

## Key Dependencies
- `tokio::runtime::Runtime` - Runtime instance and metrics access
- `std::sync::mpsc` - Inter-thread communication for worker blocking
- `tokio::time` - Async time utilities for park/unpark testing

## Architecture Patterns
- **Race Condition Handling**: Multi-threaded tests use retry loops (100 iterations, 100ms delays) to handle timing-sensitive metric updates
- **Resource Lifecycle Testing**: Tests explicitly drop runtime instances to validate shutdown metric behavior
- **Worker Blocking Strategy**: Uses coordinated task spawning with mpsc barriers to achieve deterministic worker states

## Critical Constraints
- Requires 64-bit atomic support and excludes WASI targets
- Multi-threaded tests may fail intermittently due to scheduler timing
- Park/unpark counts depend on runtime implementation details and may need adjustment for different Tokio versions
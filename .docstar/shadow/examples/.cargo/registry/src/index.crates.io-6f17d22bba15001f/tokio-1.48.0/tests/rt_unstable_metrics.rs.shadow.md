# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/rt_unstable_metrics.rs
@source-hash: ce7eb505139e1047
@generated: 2026-02-09T18:12:38Z

**Primary Purpose**: Comprehensive test suite for Tokio's runtime unstable metrics API, validating worker thread statistics, task scheduling metrics, poll time histograms, and IO driver metrics.

**Conditional Compilation** (L2-7): Tests only run with `tokio_unstable`, `full` feature, non-WASI targets, and 64-bit atomic support.

**Core Test Categories**:

**Worker Thread Metrics** (L19-236):
- `num_workers()` (L20-26): Validates current-thread (1) vs multi-thread (2) worker counts
- `num_blocking_threads()` (L28-39): Tests blocking thread pool size tracking
- `num_idle_blocking_threads()` (L41-63): Verifies idle thread detection with timing considerations
- `blocking_queue_depth()` (L65-93): Tests blocking task queue depth using mutex synchronization
- `worker_noop_count()` (L216-236): Validates no-op park event counting

**Task Scheduling Metrics** (L95-568):
- `spawned_tasks_count()` (L96-118): Tracks total spawned tasks across runtime types
- `remote_schedule_count()` (L121-151): Tests cross-thread task scheduling detection
- `worker_local_schedule_count()` (L539-568): Local vs remote scheduling differentiation

**Thread Management** (L153-213):
- `worker_thread_id_current_thread()` (L154-174): Thread ID tracking for current-thread runtime
- `worker_thread_id_threaded()` (L177-213): Multi-threaded worker thread ID validation with migration detection

**Task Stealing** (L238-267):
- `worker_steal_count()` (L239-267): Work-stealing validation using `try_spawn_stealable_task()` helper (L771-793)

**Poll Time Metrics and Histograms** (L269-536):
- `worker_poll_count_and_time()` (L270-324): Basic poll counting and timing validation
- `log_histogram()` (L327-366): Logarithmic histogram configuration with 119 buckets
- `minimal_log_histogram()` (L369-394): Minimal bucket configuration testing
- `legacy_log_histogram()` (L397-409): Deprecated API compatibility testing
- `worker_poll_count_histogram()` (L426-472): Linear histogram configuration
- `worker_poll_count_histogram_range()` (L475-508): Bucket range validation
- `worker_poll_count_histogram_disabled_without_explicit_enable()` (L511-536): Default disabled state verification

**Queue Management** (L570-665):
- `worker_overflow_count()` (L571-613): Task queue overflow detection using coordinated spawning
- `worker_local_queue_depth()` (L616-665): Local task queue depth measurement

**Budget Management** (L667-737):
- `budget_exhaustion_yield()` (L668-692): Single task budget exhaustion using `consume_budget()`
- `budget_exhaustion_yield_with_joins()` (L695-737): Budget exhaustion in concurrent scenarios

**IO Driver Metrics** (L739-769, Linux/macOS only):
- `io_driver_fd_count()` (L741-757): File descriptor registration/deregistration tracking
- `io_driver_ready_count()` (L761-769): IO readiness event counting

**Helper Functions**:
- `current_thread()` (L795-800): Creates single-threaded runtime
- `threaded()` (L802-808): Creates 2-worker multi-threaded runtime  
- `threaded_no_lifo()` (L810-817): Multi-threaded runtime with LIFO slot disabled
- `us(n)` (L819-821): Duration helper for microseconds
- `try_spawn_stealable_task()` (L771-793): Creates task designed to be stolen by other workers

**Key Dependencies**: Uses `tokio::runtime::Runtime`, histogram configurations, task spawning, time utilities, and cross-thread synchronization primitives.

**Architecture**: Systematic validation of runtime metrics through controlled scenarios, ensuring metric accuracy across different runtime configurations and workload patterns.
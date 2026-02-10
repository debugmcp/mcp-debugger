# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/metrics/runtime.rs
@source-hash: 1e30b59e511f06ff
@generated: 2026-02-09T18:03:17Z

## Tokio Runtime Metrics API

This file provides a high-level metrics API for the Tokio async runtime, offering detailed observability into runtime performance and resource usage.

### Core Structure

**RuntimeMetrics (L19-22)**: The primary metrics handle containing a reference-counted `Handle` to the runtime. Obtained via `Runtime::metrics()` and freely cloneable.

### Basic Runtime Metrics

**Basic Operations (L48-98)**:
- `num_workers()` (L48): Returns worker thread count (always 1 for current_thread runtime)  
- `num_alive_tasks()` (L70): Current number of spawned, non-completed tasks
- `global_queue_depth()` (L96): Tasks pending in the runtime's global injection queue

### Worker Thread Metrics (64-bit platforms only)

**Worker Performance Tracking (L137-242)**:
- `worker_total_busy_duration()` (L137): Cumulative busy time per worker (monotonic)
- `worker_park_count()` (L182): Times worker parked waiting for work (monotonic) 
- `worker_park_unpark_count()` (L236): Combined park/unpark events (odd=parked, even=active)

### Blocking Thread Pool Metrics (Unstable)

**Blocking Operations (L272-307)**:
- `num_blocking_threads()` (L272): Total blocking threads spawned
- `num_idle_blocking_threads()` (L305): Currently idle blocking threads
- `blocking_queue_depth()` (L567): Tasks pending in blocking thread pool

### Task Poll Time Histograms (Unstable)

**Poll Time Analysis (L426-484)**:
- `poll_time_histogram_enabled()` (L426): Whether histogram tracking is active
- `poll_time_histogram_num_buckets()` (L467): Number of histogram buckets
- `poll_time_histogram_bucket_range()` (L521): Duration range for specific bucket

### Advanced Worker Metrics (Tokio Unstable + 64-bit)

**Detailed Worker Analysis (L597-1025)**:
- Task lifecycle: `spawned_tasks_count()` (L597), `remote_schedule_count()` (L625)
- Work distribution: `worker_steal_count()` (L729), `worker_steal_operations()` (L775)
- Performance: `worker_poll_count()` (L816), `worker_mean_poll_time()` (L1017)
- Queue management: `worker_local_queue_depth()` (L393), `worker_overflow_count()` (L907)

### I/O Driver Metrics (Tokio Unstable + Net feature)

**File Descriptor Tracking (L1055-1116)**:
- `io_driver_fd_registered_count()` (L1055): Total FDs registered
- `io_driver_fd_deregistered_count()` (L1077): Total FDs deregistered  
- `io_driver_ready_count()` (L1099): Ready events processed

### Architectural Patterns

- **Feature-gated APIs**: Uses `cfg_64bit_metrics!`, `cfg_unstable_metrics!`, and `feature!` macros for conditional compilation
- **Monotonic counters**: All counters only increase, never reset to zero
- **Worker indexing**: Workers identified by 0-based indices, validated at runtime
- **Delegation pattern**: All metrics delegate to `self.handle.inner` methods
- **Atomic operations**: Uses `Relaxed` ordering for 64-bit atomic loads
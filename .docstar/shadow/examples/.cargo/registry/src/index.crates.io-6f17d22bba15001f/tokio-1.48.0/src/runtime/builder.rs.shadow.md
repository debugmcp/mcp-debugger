# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/builder.rs
@source-hash: b9a567bfe8c019fb
@generated: 2026-02-09T18:06:51Z

**Primary Purpose**: Builder pattern implementation for constructing Tokio Runtime instances with customizable configuration options.

**Core Structure**: The `Builder` struct (L51-136) provides a fluent interface for configuring runtime parameters before calling `build()` to create a `Runtime` instance.

## Key Configuration Categories

**Runtime Type Selection**:
- `new_current_thread()` (L240-248): Creates single-threaded runtime builder
- `new_multi_thread()` (L255-258): Creates multi-threaded work-stealing runtime builder
- `Kind` enum (L224-229): Internal representation of runtime types

**Thread Management**:
- `worker_threads()` (L417-421): Sets async worker thread count for multi-threaded runtime
- `max_blocking_threads()` (L468-472): Limits threads for blocking operations (default: 512)
- `thread_name()` (L492-496) & `thread_name_fn()` (L520-526): Thread naming configuration
- `thread_stack_size()` (L550-553): Stack size for spawned threads
- `thread_keep_alive()` (L1017-1020): Timeout for idle blocking pool threads

**Driver Configuration**:
- `enable_all()` (L343-364): Enables I/O, time, and io_uring drivers conditionally
- `enable_io()` (L1619-1622): Enables I/O driver for net/process/signal operations
- `enable_time()` (L1664-1667): Enables time driver for `tokio::time` functionality
- `max_io_events_per_tick()` (L1638-1641): Configures I/O event batch size

**Scheduling Configuration**:
- `global_queue_interval()` (L1059-1063): Controls fairness vs locality tradeoff
- `event_interval()` (L1095-1098): Balances task execution vs external event polling
- `disable_lifo_slot()` (L1211-1214): Disables LIFO optimization for better work stealing

**Lifecycle Callbacks**:
- Thread lifecycle: `on_thread_start()` (L576-582), `on_thread_stop()` (L604-610)
- Parking/unparking: `on_thread_park()` (L685-691), `on_thread_unpark()` (L723-729)
- Task lifecycle: `on_task_spawn()` (L773-779), `on_task_terminate()` (L916-922)
- Task polling: `on_before_task_poll()` (L820-826), `on_after_task_poll()` (L867-873)

## Advanced Features (Unstable APIs)

**Panic Handling**: `UnhandledPanic` enum (L147-219) with `unhandled_panic()` (L1160-1167) for configuring runtime shutdown behavior on task panics.

**Deterministic Testing**:
- `rng_seed()` (L1244-1247): Sets RNG seed for deterministic `select!` behavior
- `start_paused()` (L1714-1717): Starts runtime with paused time for testing

**Metrics**:
- `enable_metrics_poll_time_histogram()` (L1292-1295): Enables task poll time tracking
- `metrics_poll_time_histogram_configuration()` (L1432-1435): Configures histogram details
- Various deprecated histogram methods for backward compatibility

## Construction Process

**Build Methods**:
- `build()` (L942-948): Creates standard `Runtime`
- `build_local()` (L976-982): Creates `LocalRuntime` for current-thread only (unstable)

**Internal Build Flow**:
- `build_current_thread_runtime()` (L1511-1522): Constructs single-threaded runtime
- `build_threaded_runtime()` (L1723-1773): Constructs multi-threaded runtime with work-stealing
- Both use `get_cfg()` (L984-996) to create driver configuration

## Key Dependencies

- `driver::Driver`: Manages I/O and time drivers
- `blocking::BlockingPool`: Thread pool for blocking operations
- `scheduler::{CurrentThread, MultiThread}`: Core scheduling implementations
- `RngSeedGenerator`: Deterministic random number generation

## Architectural Patterns

- **Builder Pattern**: Fluent interface with method chaining
- **Feature Gating**: Conditional compilation based on cargo features (`rt-multi-thread`, `io-uring`, etc.)
- **Type Safety**: Compile-time prevention of invalid configurations (e.g., multi-thread LocalRuntime)
- **Default Values**: Sensible defaults with environment variable overrides for worker threads

The builder handles complex initialization orchestration, driver setup, thread pool creation, and scheduler configuration while maintaining a simple external API.
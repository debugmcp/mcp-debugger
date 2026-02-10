# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/blocking/pool.rs
@source-hash: aa390fb16aaaf7e0
@generated: 2026-02-09T18:03:12Z

## Purpose
Thread pool implementation for executing blocking operations in Tokio's async runtime. Manages a dynamic pool of worker threads that execute CPU-intensive or blocking tasks outside the async executor to prevent blocking async operations.

## Core Components

### BlockingPool (L19-22)
Main entry point containing a `Spawner` and shutdown receiver. Provides controlled lifecycle management and graceful shutdown capabilities.

**Key methods:**
- `new()` (L210-238): Creates pool with configurable thread capacity and keep-alive duration
- `shutdown()` (L244-279): Gracefully shuts down pool with optional timeout, joins all worker threads
- `spawner()` (L240-242): Returns reference to spawner for task submission

### Spawner (L24-27, L296-494)  
Cloneable handle for submitting blocking tasks. Contains Arc-wrapped `Inner` for thread-safe access.

**Key methods:**
- `spawn_blocking()` (L297-328): Spawns non-mandatory blocking task with size-based boxing optimization
- `spawn_mandatory_blocking()` (L336-363): Spawns mandatory task that must complete even during shutdown
- `spawn_blocking_inner()` (L367-391): Core spawning logic handling task creation and scheduling
- `spawn_task()` (L393-455): Manages task queuing and worker thread creation
- `spawn_thread()` (L457-477): Creates new worker thread with proper runtime context

### Inner (L76-103)
Core pool state containing shared mutex, condition variable, thread configuration, and metrics.

**Key fields:**
- `shared: Mutex<Shared>` (L78): Protected shared state
- `condvar: Condvar` (L81): Coordinates worker thread lifecycle
- `thread_cap: usize` (L96): Maximum allowed threads
- `keep_alive: Duration` (L99): Thread idle timeout
- `metrics: SpawnerMetrics` (L102): Thread and queue metrics

**Main loop:** `run()` (L503-599) - Worker thread execution loop alternating between BUSY (processing tasks) and IDLE (waiting for work) states.

### Shared (L105-122)
Mutex-protected shared state accessed by all worker threads.

**Key fields:**
- `queue: VecDeque<Task>` (L106): FIFO task queue
- `shutdown: bool` (L108): Shutdown flag
- `worker_threads: HashMap<usize, JoinHandle>` (L118): Active thread handles
- `last_exiting_thread: Option<JoinHandle>` (L115): Used for clean thread joining during timeout

### Task (L124-127, L155-170)
Wrapper around `UnownedTask<BlockingSchedule>` with mandatory/non-mandatory classification.

**Key methods:**
- `run()` (L160-162): Executes the task
- `shutdown_or_run_if_mandatory()` (L164-169): Conditional execution during shutdown

### SpawnerMetrics (L29-74)
Thread-safe metrics tracking using `MetricAtomicUsize`.

**Tracked metrics:**
- `num_threads`: Total worker threads
- `num_idle_threads`: Currently idle threads  
- `queue_depth`: Pending tasks in queue

## Key Patterns

**Dynamic thread management:** Pool grows up to `thread_cap` when no idle threads available (L409-442)

**Graceful shutdown:** Two-phase shutdown drains queue, handling mandatory vs non-mandatory tasks differently (L553-571)

**Size-based optimization:** Large closures (> `BOX_FUTURE_THRESHOLD`) are boxed to avoid stack overflow (L304-318)

**Thread cleanup:** Exiting threads join previous timed-out thread to avoid Valgrind false positives (L541-547)

## Critical Invariants
- `num_idle_threads` must accurately track idle workers for proper thread spawning decisions
- Shutdown flag prevents new task scheduling while allowing mandatory task completion
- Worker thread count never exceeds `thread_cap`
- Queue depth metrics maintained consistently with actual queue operations
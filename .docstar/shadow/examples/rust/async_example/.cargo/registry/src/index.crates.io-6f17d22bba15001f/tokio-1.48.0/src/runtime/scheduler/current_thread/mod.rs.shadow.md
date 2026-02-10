# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/current_thread/mod.rs
@source-hash: d2dff2f7081eefbc
@generated: 2026-02-09T17:58:25Z

## Tokio CurrentThread Scheduler

Implements a single-threaded task scheduler for Tokio runtime that executes tasks on the current thread without work-stealing.

### Core Components

**CurrentThread (L26-33)**: Main scheduler struct containing an atomic core and notification system for thread coordination.

**Handle (L36-54)**: Thread-safe handle providing access to scheduler operations, containing shared state, driver handles, blocking spawner, RNG seed generator, task hooks, and optional local thread ID for LocalRuntime.

**Core (L58-79)**: Scheduling execution context with local task queue (VecDeque), tick counter, optional driver, metrics batch, global queue interval, and panic handling flag.

**Shared (L82-100)**: Thread-shared state including injection queue for remote tasks, owned tasks collection, woken flag, configuration, and metrics.

**Context (L105-115)**: Thread-local scheduler context with handle reference, core storage in RefCell, and deferred task queue.

**CoreGuard (L721-724)**: RAII guard ensuring Core is always returned to scheduler on drop, preventing resource leaks.

### Key Operations

**new() (L128-182)**: Factory method creating CurrentThread scheduler and Handle with configured driver, spawner, metrics, and core initialization.

**block_on() (L185-224)**: Primary execution method that attempts to acquire core or waits for availability, then executes future to completion with proper context management.

**spawn()/spawn_local() (L449-507)**: Task spawning methods creating JoinHandle, binding tasks to scheduler, invoking hooks, and scheduling for execution.

**schedule() (L642-664)**: Schedule trait implementation handling local vs remote task scheduling with context awareness and driver unparking.

**shutdown() (L239-269)**: Graceful shutdown draining all queues, closing injection, submitting metrics, and shutting down drivers.

### Execution Flow

**Task Scheduling**: Core.next_task() (L319-328) alternates between local and global queues based on tick intervals for fairness.

**Parking**: Context.park() (L375-408) blocks thread on driver until I/O/timer events with before/after park hooks.

**Task Execution**: CoreGuard.block_on() (L728-815) runs main scheduler loop polling future, processing tasks with budget limits, handling panics, and yielding to driver.

### Thread Safety & Concurrency

Uses AtomicCell for core ownership transfer between threads, AtomicBool for woken state, and Arc for shared handle distribution. Injection queue allows cross-thread task submission with proper synchronization.

### Architecture Patterns

- **Capability Token**: Core struct acts as execution capability
- **RAII**: CoreGuard ensures proper cleanup
- **Context Management**: Thread-local storage with proper enter/exit semantics
- **Metrics Collection**: Comprehensive scheduling and execution metrics
- **Hook System**: Extensible callbacks for spawn/terminate/poll events

### Configuration

DEFAULT_GLOBAL_QUEUE_INTERVAL (L125): Controls global queue check frequency (31 ticks). INITIAL_CAPACITY (L120): Local queue initial size (64 tasks). Event interval configuration controls task batch processing limits.
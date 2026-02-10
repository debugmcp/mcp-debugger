# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/multi_thread/worker.rs
@source-hash: f648818f306f64da
@generated: 2026-02-09T17:58:29Z

## Primary Purpose
Core worker implementation for Tokio's multi-threaded runtime scheduler. Manages worker threads that execute tasks from local and global queues, handles work stealing between workers, and coordinates parking/unparking for efficient resource utilization.

## Key Architecture

### Core Data Structures

**Worker (L87-97)**: Main worker handle containing scheduler reference, worker index, and atomic core storage for hand-off between threads during `block_in_place`.

**Core (L100-142)**: Worker's execution state containing:
- `lifo_slot` (L109): LIFO optimization for locality - last scheduled task runs next
- `run_queue` (L116): Worker-local task queue  
- `is_searching/is_shutdown/is_traced` (L120-126): State flags
- `park` (L132): Thread parking mechanism
- `stats` (L135): Performance metrics
- `global_queue_interval` (L138): Tunable frequency for checking global queue

**Shared (L145-187)**: State shared across all workers containing:
- `remotes` (L148): Per-worker remote access for work stealing
- `inject` (L153): Global injection queue for cross-thread task submission
- `idle` (L156): Idle worker coordination
- `owned` (L159): All active tasks collection
- `shutdown_cores` (L169): Cores observed shutdown signal

**Context (L208-218)**: Thread-local execution context linking worker to core with deferred waker queue.

### Key Algorithms

**Task Scheduling Priority (L1080-1112)**:
1. LIFO slot (if enabled and not yielding)
2. Local run queue back
3. Global queue every `global_queue_interval` ticks

**Work Stealing (L869-897)**: Random start position, iterate through all workers, steal from their queues, fallback to global queue.

**Worker State Transitions**:
- Searching ↔ Processing (L899-914)
- Parked ↔ Searching (L932-987)

## Critical Functions

**create() (L237-314)**: Initializes worker pool with local queues, shared state, and handle.

**run() (L462-512)**: Main worker entry point - acquires core and enters execution loop.

**Context::run() (L515-567)**: Core execution loop handling task polling, work stealing, and parking.

**block_in_place() (L317-452)**: Transfers core to new thread when blocking operation needed, with automatic core recovery.

**Task Execution (L569-683)**: Runs tasks with LIFO slot optimization, budget checking, and task hooks.

## Shutdown Process
1. Close inject queue and owned tasks (step 1)
2. Workers observe shutdown signal (step 2) 
3. Pre-shutdown drains remaining tasks (step 3)
4. Workers push cores to shutdown collection (step 5)
5. Final cleanup drains all queues (step 6)

## Performance Optimizations

- **LIFO Slot**: Improves cache locality by running recently scheduled tasks first
- **Work Stealing**: Load balancing with random starting position
- **Adaptive Global Queue Polling**: Tunable interval based on load
- **Batch Operations**: Efficient multi-task operations on queues
- **Budget-based Execution**: Prevents task starvation via cooperation points

## Dependencies
- `queue`: Local/steal queue implementations
- `inject`: Global injection queue 
- `idle`: Worker idle state coordination
- `parking`: Thread parking/unparking primitives
- `task`: Task execution and ownership tracking
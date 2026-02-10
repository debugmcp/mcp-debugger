# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/task/blocking.rs
@source-hash: 821efe697c70bf6b
@generated: 2026-02-09T18:06:46Z

## Primary Purpose
Provides two functions for handling blocking operations in Tokio async runtime: `block_in_place` for executing blocking code on the current thread without blocking the executor, and `spawn_blocking` for running blocking operations on dedicated threads.

## Key Functions

### `block_in_place<F, R>(f: F) -> R` (L74-79)
- **Availability**: Only in multi-threaded runtime (`cfg_rt_multi_thread!`)
- **Purpose**: Executes blocking function on current thread while allowing executor to hand off other tasks to new worker threads
- **Constraints**: Panics if called from `current_thread` runtime
- **Use case**: CPU-bound tasks or synchronous calls that need to run on current thread
- **Implementation**: Delegates to `crate::runtime::scheduler::block_in_place(f)`

### `spawn_blocking<F, R>(f: F) -> JoinHandle<R>` (L205-211)
- **Availability**: Available in any runtime (`cfg_rt!`)
- **Purpose**: Runs blocking closure on dedicated blocking thread pool
- **Returns**: `JoinHandle<R>` for awaiting result
- **Thread management**: Spawns new threads up to configured limit, queues tasks beyond limit
- **Constraints**: Tasks cannot be aborted once started running
- **Implementation**: Delegates to `crate::runtime::spawn_blocking(f)`

## Key Dependencies
- `crate::task::JoinHandle` (L1) - Return type for `spawn_blocking`
- `crate::runtime::scheduler::block_in_place` - Implementation for `block_in_place`
- `crate::runtime::spawn_blocking` - Implementation for `spawn_blocking`

## Critical Design Patterns

### Conditional Compilation
- `cfg_rt_multi_thread!` gates `block_in_place` to multi-threaded runtimes only
- `cfg_rt!` makes `spawn_blocking` available in all runtime configurations

### Error Handling
- `block_in_place` panics in `current_thread` runtime
- `spawn_blocking` cannot abort running tasks (only queued tasks)

### Resource Management
- `spawn_blocking` manages thread pool with configurable upper limit
- Both functions handle blocking operations without starving async executor

## Important Constraints
- `block_in_place` suspends concurrent code in same task (unlike `spawn_blocking`)
- Blocking operations cannot be cancelled once started
- Runtime shutdown waits indefinitely for blocking operations unless timeout used
- Large thread limit by default for `spawn_blocking` requires manual coordination for CPU-bound work
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/task_hooks.rs
@source-hash: 0c7da3b5328a2c5c
@generated: 2026-02-09T18:06:42Z

## Task Hooks Implementation for Tokio Runtime

This file provides a callback system for monitoring task lifecycle events within the Tokio async runtime. It enables users to hook into task spawning, polling, and termination events for debugging, profiling, and monitoring purposes.

### Core Components

**TaskHooks struct (L40-48)**: Main hook registry that holds optional callbacks for different task events. Contains:
- `task_spawn_callback`: Invoked when tasks are created
- `task_terminate_callback`: For task completion/cancellation 
- `before_poll_callback`/`after_poll_callback`: Poll lifecycle hooks (unstable feature only)

**TaskMeta struct (L59-66)**: Metadata container passed to hook callbacks, providing:
- `id`: Opaque task identifier (L61)
- `spawned_at`: Source location where task was created (L64)
- `_phantom`: Lifetime marker for borrowing semantics (L65)

**TaskCallback type alias (L82)**: Thread-safe function pointer type for hook implementations using `Arc<dyn Fn + Send + Sync>`.

### Key Methods

**TaskHooks implementation (L4-38)**:
- `spawn()` (L5-9): Triggers spawn callback if registered
- `from_config()` (L12-21): Factory method creating hooks from runtime configuration
- `poll_start_callback()`/`poll_stop_callback()` (L25-37): Poll event dispatchers (unstable only)

**TaskMeta implementation (L68-80)**:
- `id()` (L71-73): Accessor for task ID
- `spawned_at()` (L77-79): Returns spawn location (unstable only)

### Architecture Notes

- Heavy use of conditional compilation with `#[cfg(tokio_unstable)]` for experimental features
- All callbacks are optional and checked before invocation to minimize runtime overhead
- Thread-safe design using `Arc` for callback storage and `Clone` derive for `TaskHooks`
- Lifetime parameter `'a` in `TaskMeta` ensures metadata doesn't outlive the underlying task data

### Dependencies

- Imports `Config` from parent module for runtime configuration
- Uses `std::marker::PhantomData` for zero-cost lifetime tracking
- References `super::task::Id` and `SpawnLocation` types for task identification
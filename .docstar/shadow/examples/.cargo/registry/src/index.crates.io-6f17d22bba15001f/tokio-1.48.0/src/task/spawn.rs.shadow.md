# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/task/spawn.rs
@source-hash: b2607c5e690ed84d
@generated: 2026-02-09T18:06:46Z

## Primary Purpose
Core task spawning interface for Tokio runtime. Provides the public `spawn` function and internal `spawn_inner` for creating concurrent async tasks.

## Key Functions

### `spawn<F>` (L169-180)
- **Public API**: Main entry point for spawning async tasks
- **Constraints**: Requires `F: Future + Send + 'static`, `F::Output: Send + 'static`
- **Size Optimization**: Automatically boxes futures exceeding `BOX_FUTURE_THRESHOLD` to reduce stack usage
- **Returns**: `JoinHandle<F::Output>` for task management and result retrieval
- **Behavior**: Tasks start immediately upon spawn, execute concurrently, no synchronous polling guaranteed

### `spawn_inner<T>` (L183-209)
- **Internal Implementation**: Core spawning logic used by public `spawn`
- **Tracing Integration**: Conditionally wraps futures with trace instrumentation (L190-201)
- **Task Creation**: Generates unique task IDs, creates traced task objects
- **Runtime Integration**: Uses `context::with_current` to access runtime handle for actual spawning
- **Error Handling**: Panics if runtime context unavailable

## Dependencies
- `crate::runtime::BOX_FUTURE_THRESHOLD`: Size threshold for future boxing
- `crate::task::JoinHandle`: Return type for task handles
- `crate::util::trace::SpawnMeta`: Task metadata for tracing
- `crate::runtime::{context, task}`: Core runtime and task infrastructure

## Critical Constraints
- **Runtime Context Required**: Must be called within Tokio runtime context or panics
- **Send Requirement**: Tasks and outputs must be `Send` for thread safety
- **!Send Values**: Can use `!Send` types between await points but not across them
- **No Completion Guarantee**: Tasks may be dropped during runtime shutdown

## Architectural Decisions
- **Conditional Boxing**: Large futures automatically boxed to prevent stack overflow
- **Immediate Execution**: Tasks begin running immediately, not lazily
- **Tracing Integration**: Optional instrumentation for task debugging (Linux-specific)
- **ID Generation**: Each task gets unique identifier for runtime tracking

## Configuration Gates
- Main functionality gated behind `cfg_rt!` macro
- Tracing features conditionally compiled with specific target/feature requirements
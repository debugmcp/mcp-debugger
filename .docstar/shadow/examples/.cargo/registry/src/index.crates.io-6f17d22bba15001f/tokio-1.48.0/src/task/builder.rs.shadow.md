# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/task/builder.rs
@source-hash: 1369662ddafafd64
@generated: 2026-02-09T18:06:46Z

## Purpose
Builder pattern for configuring and spawning Tokio tasks with optional metadata. Provides a unified interface for spawning different types of tasks (Send futures, !Send local futures, and blocking code) with configurable properties like task names.

## Key Structure
**Builder<'a> (L61-65)**: Main configuration struct containing:
- `name: Option<&'a str>` - Optional task name for debugging/tracing

## Core Methods
**new() (L69-71)**: Creates default builder instance

**name() (L74-76)**: Assigns name to task, returns new builder with name set

**Spawning Methods**:
- **spawn() (L87-98)**: Spawns Send futures on current runtime. Uses size optimization - boxes futures larger than `BOX_FUTURE_THRESHOLD`
- **spawn_on() (L108-119)**: Spawns Send futures on specific runtime handle
- **spawn_local() (L136-147)**: Spawns !Send futures on current LocalSet
- **spawn_local_on() (L157-172)**: Spawns !Send futures on specific LocalSet
- **spawn_blocking() (L183-193)**: Spawns blocking code on blocking threadpool
- **spawn_blocking_on() (L202-231)**: Spawns blocking code on specific handle's threadpool

## Key Dependencies
- `crate::runtime::{Handle, BOX_FUTURE_THRESHOLD}` - Runtime management and size threshold
- `crate::task::{JoinHandle, LocalSet}` - Task handles and local execution
- `crate::util::trace::SpawnMeta` - Task metadata for tracing
- `std::mem` - Memory size calculations

## Architecture Patterns
- **Size-based optimization**: All spawn methods check `mem::size_of::<T>() > BOX_FUTURE_THRESHOLD` and conditionally box large futures/functions
- **Builder pattern**: Immutable configuration chaining
- **Consistent metadata**: All spawn operations create `SpawnMeta::new(self.name, size)`
- **Error handling**: Methods return `io::Result<JoinHandle<T>>`

## Critical Invariants
- All spawn methods are `#[track_caller]` for better error diagnostics
- Future size calculation happens before spawning for optimization decisions
- Send bounds enforced at compile time for runtime spawns
- !Send futures restricted to LocalSet contexts
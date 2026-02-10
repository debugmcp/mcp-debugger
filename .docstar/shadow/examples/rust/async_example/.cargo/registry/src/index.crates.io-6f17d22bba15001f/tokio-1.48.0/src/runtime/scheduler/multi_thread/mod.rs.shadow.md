# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/multi_thread/mod.rs
@source-hash: 2fae4c9f66b57d15
@generated: 2026-02-09T17:58:19Z

**Multi-threaded Runtime Scheduler Module**

This module implements Tokio's work-stealing thread pool scheduler for executing async tasks across multiple threads.

## Primary Purpose
Entry point and orchestrator for the multi-threaded runtime scheduler, providing the main `MultiThread` struct that coordinates work-stealing execution of futures across a thread pool.

## Key Components

### Core Structure
- **`MultiThread` (L52)**: Zero-sized marker struct representing the multi-threaded scheduler
  - `new()` (L57-76): Factory method creating scheduler with thread pool, driver, and blocking spawner
  - `block_on()` (L82-89): Executes future on current thread while spawned tasks use thread pool
  - `shutdown()` (L91-96): Gracefully shuts down the scheduler

## Module Organization
The module aggregates several sub-modules that implement different aspects of the work-stealing scheduler:

- **`counters`** (L3-4): Performance and debugging counters
- **`handle`** (L6-7): Handle for interacting with the scheduler (`Handle`)
- **`overflow`** (L9-10): Overflow queue management (`Overflow`)
- **`idle`** (L12-13): Worker thread idle state tracking (`Idle`)
- **`stats`** (L15-16): Runtime statistics collection (`Stats`)
- **`park`** (L18-19): Thread parking/unparking primitives (`Parker`, `Unparker`)
- **`queue`** (L21): Work-stealing queues (public for internal use)
- **`worker`** (L23-24): Core worker thread implementation (`Context`, `Launch`, `Shared`)

## Conditional Compilation
- **Task dumping support** (L26-31): Includes tracing capabilities when `taskdump` feature enabled
- **Mock tracing** (L33-36): Provides no-op tracing when `taskdump` disabled

## Key Dependencies
- **Runtime components**: blocking spawner, driver system, scheduler interfaces
- **Synchronization**: Arc for shared ownership
- **Utilities**: RNG seed generation for work stealing randomization

## Architectural Patterns
- **Factory pattern**: `new()` method creates all necessary components and returns them as a tuple
- **Delegation pattern**: Core functionality delegated to worker module
- **Feature-gated compilation**: Different tracing implementations based on compile-time features

## Critical Invariants
- Scheduler handle passed to `shutdown()` must be `MultiThread` variant (panics otherwise)
- Thread pool size and configuration established at creation time
- Work-stealing requires proper RNG seeding for load balancing effectiveness
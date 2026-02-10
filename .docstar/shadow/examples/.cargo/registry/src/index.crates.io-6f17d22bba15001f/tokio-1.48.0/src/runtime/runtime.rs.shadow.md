# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/runtime.rs
@source-hash: 7df97145c9d4fa5f
@generated: 2026-02-09T18:06:49Z

## Primary Purpose
Core Tokio runtime implementation providing the main `Runtime` struct that orchestrates task scheduling, I/O operations, timers, and blocking operations. This is the primary entry point for executing asynchronous work in Tokio applications.

## Key Types and Architecture

### Runtime Struct (L95-104)
The main runtime type with three core components:
- `scheduler: Scheduler` - Task execution engine (current-thread or multi-thread)
- `handle: Handle` - Runtime handle for spawning and management
- `blocking_pool: BlockingPool` - Dedicated thread pool for blocking operations

### RuntimeFlavor Enum (L109-116)
Public API enum distinguishing between:
- `CurrentThread` - Single-threaded execution
- `MultiThread` - Multi-threaded work-stealing scheduler

### Scheduler Enum (L119-127)
Internal scheduler abstraction supporting:
- `CurrentThread(CurrentThread)` - Always available
- `MultiThread(MultiThread)` - Feature-gated behind "rt-multi-thread"

## Core Methods

### Runtime Creation
- `new() -> io::Result<Runtime>` (L172-174) - Creates multi-thread runtime with all features enabled
- `from_parts()` (L130-140) - Internal constructor for assembling runtime components

### Task Management
- `spawn<F>(future: F) -> JoinHandle<F::Output>` (L236-249) - Spawns async task with future size optimization
- `spawn_blocking<F, R>(func: F) -> JoinHandle<R>` (L272-278) - Delegates to blocking pool
- `block_on<F: Future>(future: F) -> F::Output` (L337-344) - Main execution entry point with size optimization

### Context and Access
- `handle() -> &Handle` (L199-201) - Returns runtime handle for cloning/sharing
- `enter() -> EnterGuard` (L413-415) - Establishes runtime context for current thread
- `metrics() -> RuntimeMetrics` (L490-492) - Runtime performance monitoring

### Shutdown Management
- `shutdown_timeout(duration: Duration)` (L447-451) - Graceful shutdown with timeout
- `shutdown_background()` (L484-486) - Immediate shutdown without waiting
- `Drop::drop()` (L495-512) - Ensures proper cleanup with scheduler-specific logic

## Important Patterns

### Future Size Optimization
Both `spawn()` and `block_on()` implement dynamic boxing based on `BOX_FUTURE_THRESHOLD` to optimize memory usage for large futures.

### Conditional Compilation
Extensive use of `cfg!` attributes for feature-gating multi-thread support, ensuring single-thread builds remain lightweight.

### Tracing Integration
Conditional tracing instrumentation in `block_on_inner()` (L347-371) for debugging and observability.

## Key Dependencies
- `crate::runtime::Handle` - Runtime handle for task spawning and context
- `crate::runtime::blocking::BlockingPool` - Blocking operation management
- `crate::runtime::scheduler::{CurrentThread, MultiThread}` - Scheduler implementations
- `crate::task::JoinHandle` - Task result handles

## Critical Invariants
- Runtime context must be properly entered before using tokio spawn functions
- Shutdown methods require exclusive ownership (move semantics)
- Multi-thread features are conditionally compiled and may not be available
- Drop implementation ensures tasks are properly cleaned up within runtime context
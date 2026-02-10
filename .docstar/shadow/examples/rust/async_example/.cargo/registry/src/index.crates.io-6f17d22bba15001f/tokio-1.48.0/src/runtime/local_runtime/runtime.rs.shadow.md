# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/local_runtime/runtime.rs
@source-hash: 69c750fc260f83f8
@generated: 2026-02-09T18:03:11Z

## Primary Purpose
LocalRuntime is a single-threaded Tokio runtime that enables spawning non-Send tasks without LocalSet, restricted to the thread where it was created. This is internally identical to `current_thread` runtime but with enhanced local task spawning capabilities.

## Key Components

### LocalRuntime (L33-45)
The main runtime struct containing:
- `scheduler`: LocalRuntimeScheduler enum (always CurrentThread variant)
- `handle`: Runtime handle with driver access
- `blocking_pool`: BlockingPool for spawn_blocking operations
- `_phantom`: PhantomData<*mut u8> marker making struct !Send + !Sync

### LocalRuntimeScheduler (L49-52)
Enum wrapper around CurrentThread scheduler, designed for future extensibility but currently only supports single-threaded execution.

## Core Methods

### Construction & Access
- `new()` (L92-96): Creates default runtime with all features enabled via Builder
- `from_parts()` (L55-66): Internal constructor assembling runtime from components
- `handle()` (L120-122): Returns reference to runtime handle for cross-thread spawning

### Task Spawning
- `spawn_local<F>()` (L147-163): Spawns !Send futures locally, with size-based boxing optimization using BOX_FUTURE_THRESHOLD
- `spawn_blocking()` (L190-196): Delegates to handle for blocking task execution on thread pool

### Execution Control  
- `block_on()` (L220-229): Entry point for executing futures, with size-based boxing and tracing integration
- `block_on_inner()` (L232-257): Internal execution logic with conditional tracing and taskdump support
- `enter()` (L301-303): Creates execution context guard for runtime-dependent operations

### Shutdown Management
- `shutdown_timeout()` (L337-341): Graceful shutdown with duration limit for blocking tasks
- `shutdown_background()` (L371-373): Immediate shutdown without waiting (zero timeout)
- Drop implementation (L382-393): Ensures CurrentThread scheduler shutdown within runtime context

## Architecture Patterns

### Size Optimization
Future boxing logic at spawn (L157-161) and block_on (L224-228) based on BOX_FUTURE_THRESHOLD to balance stack usage vs heap allocation.

### Conditional Compilation
Extensive cfg guards for unstable features:
- taskdump support (L233-240)
- tracing integration (L242-248)

### Safety Constraints
PhantomData marker prevents Send/Sync, enforcing single-thread usage. Unsafe spawn_local calls (L156) rely on LocalRuntime context guarantees.

## Dependencies
- CurrentThread scheduler from runtime::scheduler
- Handle and Builder from runtime core
- BlockingPool for thread pool operations
- SpawnMeta and tracing utilities

## Critical Invariants
- Only supports CurrentThread scheduler (unreachable branches at L255, L390)
- Must be used from creation thread
- Incompatible with LocalSet usage
- spawn_local safety depends on LocalRuntime context
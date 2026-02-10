# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/local_runtime/
@generated: 2026-02-09T18:16:07Z

## Overall Purpose
This directory implements Tokio's LocalRuntime - a single-threaded async runtime that enables spawning non-Send tasks without requiring LocalSet. It provides a lightweight alternative to Tokio's multi-threaded runtime by eliminating work-stealing overhead and cross-thread synchronization, while offering enhanced local task spawning capabilities restricted to the creation thread.

## Key Components and Architecture

### Module Structure
- **mod.rs**: Module aggregator that serves as the public API entry point, exporting key types and providing access to internal scheduler interfaces
- **runtime.rs**: Core implementation containing LocalRuntime and LocalRuntimeScheduler with all execution logic
- **options.rs**: Configuration placeholder designed for future extensibility with thread-safety constraints

### Component Relationships
The LocalRuntime internally wraps a CurrentThread scheduler but exposes a specialized API for local task spawning. The LocalRuntimeScheduler enum provides future extensibility while currently only supporting single-threaded execution. LocalOptions serves as a configuration facade with `!Send + !Sync` markers enforcing thread locality.

## Public API Surface

### Primary Entry Points
- **LocalRuntime::new()**: Creates default runtime with all Tokio features enabled
- **LocalRuntime::spawn_local<F>()**: Core capability for spawning !Send futures locally with size-based optimization
- **LocalRuntime::block_on()**: Main execution entry point for running futures to completion
- **LocalOptions::default()**: Configuration constructor (currently empty but future-proofed)

### Runtime Control
- **handle()**: Provides access to runtime handle for cross-thread operations
- **spawn_blocking()**: Thread pool delegation for blocking operations
- **shutdown_timeout() / shutdown_background()**: Graceful and immediate shutdown options
- **enter()**: Creates execution context guards for runtime-dependent operations

## Internal Organization and Data Flow

### Execution Model
LocalRuntime follows a single-threaded execution model where all async tasks run on the creation thread. The runtime manages three key subsystems:
1. **Task Scheduler**: CurrentThread scheduler for async task execution
2. **I/O Driver**: Integrated through runtime handle for async I/O operations  
3. **Blocking Pool**: Separate thread pool for spawn_blocking operations

### Safety and Optimization Patterns
- **Thread Safety**: PhantomData<*mut u8> markers throughout ensure !Send + !Sync properties
- **Memory Optimization**: Conditional future boxing based on BOX_FUTURE_THRESHOLD to balance stack vs heap usage
- **Feature Gating**: Extensive conditional compilation for unstable features like taskdump and tracing

## Important Conventions

### Design Patterns
- **Future-Proofing**: LocalOptions uses #[non_exhaustive] and placeholder structure for anticipated configuration expansion
- **Size-Based Boxing**: Automatic future boxing optimization at spawn and block_on boundaries
- **Context Management**: Runtime enter/exit semantics for proper execution context handling

### Critical Constraints
- Must be used exclusively from the thread where created
- Cannot be combined with LocalSet (provides alternative local spawning)
- All spawned tasks must complete before shutdown
- spawn_local safety relies on LocalRuntime context guarantees

### Integration Points
The local runtime integrates with Tokio's broader ecosystem through the Builder pattern for construction and Handle for cross-thread communication, while maintaining strict single-thread execution semantics for the actual task execution.
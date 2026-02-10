# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/handle.rs
@source-hash: 334ea66c242d0057
@generated: 2026-02-09T18:06:50Z

## Handle to Tokio Runtime - Public API and Context Management

**Primary Purpose**: Provides a Handle abstraction over Tokio runtime instances, enabling task spawning, runtime context management, and blocking operations from any thread.

### Core Types
- **Handle (L14-16)**: Reference-counted handle to runtime, contains `scheduler::Handle` wrapper
- **EnterGuard<'a> (L35-38)**: RAII guard for runtime context, auto-exits on drop with lifetime tied to Handle
- **TryCurrentError (L659-661)**: Error type for failed runtime context access

### Key Public Methods

**Context Management**:
- `Handle::enter() -> EnterGuard<'_>` (L87-95): Sets current runtime context with RAII guard
- `Handle::current()` (L145-149): Gets handle to current runtime, panics if no context
- `Handle::try_current()` (L156-160): Non-panicking version returning Result

**Task Spawning**:
- `spawn<F>(&self, future: F)` (L197-208): Spawns Send future, auto-boxes if size > BOX_FUTURE_THRESHOLD
- `spawn_blocking<F, R>(&self, func: F)` (L234-240): Runs blocking function on dedicated thread pool
- `spawn_named<F>` (L374-391): Internal spawning with metadata, handles tracing features
- `spawn_local_named<F>` (L395-416): Unsafe local spawning without Send requirement

**Blocking Execution**:
- `block_on<F: Future>(&self, future: F)` (L342-349): Blocks current thread until future completes
- `block_on_inner<F>` (L352-371): Implementation handling tracing and context entry

**Runtime Introspection**:
- `runtime_flavor() -> RuntimeFlavor` (L442-448): Returns CurrentThread or MultiThread
- `metrics() -> RuntimeMetrics` (L482-484): Returns performance metrics view
- `id() -> runtime::Id` (L470-477): Unstable API for runtime ID

### Task Dumping (Unstable Feature)
- `dump() -> Dump` (L613-627): Captures runtime state snapshot, Linux-only with extensive requirements
- `is_tracing() -> bool` (L633-635): Hidden API for integration testing

### Architecture Notes
- Handle is internally reference-counted and freely cloneable
- Size-based optimization: futures > BOX_FUTURE_THRESHOLD get boxed automatically
- Context management uses thread-local storage with proper cleanup
- Supports both current-thread and multi-thread runtime flavors
- Extensive conditional compilation for unstable features (taskdump, tracing)

### Error Handling
TryCurrentError variants (L690-693):
- `NoContext`: No runtime in current context
- `ThreadLocalDestroyed`: Thread-local storage destroyed (rare edge case)

### Safety Constraints
- EnterGuard must be dropped in reverse acquisition order to prevent panics
- block_on panics if called from async context
- Current thread runtime limitations for block_on (cannot drive IO/timers)
- Task dumping has significant platform and performance limitations
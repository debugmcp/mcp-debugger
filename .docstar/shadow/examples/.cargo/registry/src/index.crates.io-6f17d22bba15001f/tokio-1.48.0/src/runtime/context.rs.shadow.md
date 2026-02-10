# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/context.rs
@source-hash: 0902a4bd6b8e70a0
@generated: 2026-02-09T18:06:46Z

## Purpose
Thread-local runtime context management for Tokio async runtime, providing per-thread state tracking for schedulers, tasks, random number generation, and cooperative budgeting.

## Architecture
- Uses `tokio_thread_local!` macro to create thread-local `CONTEXT` singleton (L77-122)
- Context fields are conditionally compiled based on feature flags (`rt`, `macros`, `taskdump`)
- Core pattern: thread-local state accessed via `CONTEXT.with()` or `CONTEXT.try_with()`

## Key Components

### Context struct (L36-75)
Thread-local state container with fields:
- `thread_id`: Unique thread identifier (L39)
- `current`: Runtime handle for spawning/drivers (L43)  
- `scheduler`: Internal scheduler context via `Scoped<scheduler::Context>` (L47)
- `current_task_id`: Active task tracking (L50)
- `runtime`: Runtime entry state via `EnterRuntime` enum (L58)
- `rng`: Fast random number generator (L61)
- `budget`: Cooperative task yielding budget (L65)
- `trace`: Task dump tracing context (L74, Linux-specific)

### Public API Functions

**Random Number Generation:**
- `thread_rng_n(n: u32) -> u32` (L125-132): Thread-local fast RNG with lazy initialization

**Budget Management:**
- `budget<R>(f: impl FnOnce(&Cell<coop::Budget>) -> R) -> Result<R, AccessError>` (L134-136): Access cooperative budget

**Thread Management (rt feature):**
- `thread_id() -> Result<ThreadId, AccessError>` (L141-152): Get/create unique thread ID
- `set_current_task_id(id: Option<Id>) -> Option<Id>` (L154-156): Update current task
- `current_task_id() -> Option<Id>` (L158-160): Get current task ID

**Scheduler Integration:**
- `defer(waker: &Waker)` (L162-173): Defer waker or wake immediately if outside runtime
- `set_scheduler<R>(v: &scheduler::Context, f: impl FnOnce() -> R) -> R` (L175-177): Set scheduler context
- `with_scheduler<R>(f: impl FnOnce(Option<&scheduler::Context>) -> R) -> R` (L179-191): Access scheduler if runtime entered

**Task Tracing (taskdump feature):**
- `with_trace<R>(f: impl FnOnce(&trace::Context) -> R) -> Option<R>` (L196-198): Unsafe trace context access

## Dependencies
- `crate::loom::thread::AccessError`: Thread access error handling
- `crate::task::coop`: Cooperative task budgeting
- `crate::util::rand::FastRand`: Fast RNG implementation
- Various sub-modules: `blocking`, `current`, `runtime`, `scoped`, `runtime_mt`

## Critical Patterns
1. **Lazy Initialization**: Thread ID and RNG created on first access
2. **Feature Gating**: Heavy use of `cfg!` macros for conditional compilation
3. **Error Handling**: `try_with()` returns `AccessError` if thread-local access fails
4. **Runtime State**: `EnterRuntime` enum tracks whether thread is driving a runtime
5. **Scoped Context**: Scheduler context uses RAII pattern via `Scoped<T>`
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/task/mod.rs
@source-hash: 0326e3de3246c568
@generated: 2026-02-09T18:06:52Z

**Primary Purpose:**
Main module entry point for Tokio's task system, providing APIs for spawning, managing, and coordinating asynchronous green-thread tasks. This module serves as the public interface for task operations and re-exports core functionality from various submodules.

**Key Components:**

**Core Task Operations (L277-291):**
- `spawn` (L284): Creates new async tasks on the Tokio runtime
- `spawn_blocking` (L281): Executes blocking operations on dedicated thread pool
- `block_in_place` (L287): Multi-threaded runtime only - transitions current thread to blocking
- `yield_now` (L291): Cooperatively yields control back to scheduler

**Task Management Types (L278, L312, L320):**
- `JoinHandle`/`JoinError` (L278): Handle and error types for awaiting task completion
- `AbortHandle` (L312): Lightweight handle for task cancellation without waiting
- `JoinSet` (L311): Collection for managing multiple related tasks
- `Id`, `id`, `try_id` (L320): Task identification utilities

**Local Task System (L304-305):**
- `LocalSet`: Single-threaded task executor for !Send futures
- `spawn_local`: Spawns tasks that don't need to be Send
- `LocalEnterGuard`: Guard for entering LocalSet context

**Cooperative Scheduling (L293-302):**
- `coop` module: Budget-based cooperative scheduling system
- Deprecated re-exports of `consume_budget`, `unconstrained`, `Unconstrained` for backward compatibility

**Task-Local Storage (L307-308):**
- `LocalKey`: Thread-local-like storage scoped to individual tasks
- `TaskLocalFuture` (L329): Future type for task-local operations

**Conditional Compilation:**
- `cfg_rt!` macro (L277): Enables runtime-dependent features
- `cfg_rt_multi_thread!` (L286): Multi-threaded runtime specific features
- `cfg_trace!` (L322): Task tracing/debugging support with `Builder` type

**Module Architecture:**
The module uses conditional compilation extensively to include only relevant functionality based on feature flags. Core runtime features are gated behind `cfg_rt!`, while `cfg_not_rt!` (L333) provides minimal cooperative scheduling for non-runtime contexts.

**Dependencies:**
- Heavily relies on `crate::runtime::task` for core task primitives
- Integrates with runtime scheduling and thread pool management
- Connects to tracing/debugging infrastructure when enabled

**Critical Design Notes:**
- Tasks are cooperative (yield at .await points) not preemptive
- Blocking operations must use special APIs to avoid blocking entire threads  
- Task cancellation is cooperative - tasks must yield to be cancelled
- Local tasks (!Send) require special single-threaded executor
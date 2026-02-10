# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/defer.rs
@source-hash: bbec9c32bb4c3045
@generated: 2026-02-09T18:03:04Z

**Purpose**: Thread-local deferred waker management for Tokio's single-threaded scheduler. Accumulates and batch-processes task wakers to optimize task notification patterns.

**Core Structure**:
- `Defer` struct (L4-6): Container for deferred wakers using interior mutability
  - `deferred` field: `RefCell<Vec<Waker>>` for thread-safe mutation in single-threaded context

**Key Methods**:
- `new()` (L9-13): Creates empty defer queue with default RefCell
- `defer(&self, waker: &Waker)` (L15-26): Adds waker to queue with deduplication
  - Optimization: Only checks last waker for duplicates (L19-23)
  - Rationale: Same task repeatedly deferring itself is common pattern
- `is_empty()` (L28-30): Non-mutating check for queue state
- `wake()` (L32-36): Drains and wakes all deferred tasks in LIFO order
- `take_deferred()` (L39-42): Extracts all wakers without waking (taskdump feature only)

**Architecture Notes**:
- Uses RefCell for interior mutability in single-threaded scheduler context
- LIFO processing order (pop from end) may affect task scheduling fairness
- Deduplication strategy only compares with last element for performance
- Part of Tokio's scheduler subsystem for batching wake operations

**Critical Invariants**:
- Must only be used in single-threaded context (RefCell constraint)
- Waker deduplication relies on `will_wake()` semantic equality
- All deferred wakers must eventually be consumed via `wake()` or `take_deferred()`
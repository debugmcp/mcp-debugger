# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/metrics/scheduler.rs
@source-hash: d384da20159a9f60
@generated: 2026-02-09T18:03:01Z

**Purpose**: Provides metrics collection for Tokio's task scheduler, tracking scheduling events and budget exhaustion.

**Key Components**:
- `SchedulerMetrics` struct (L12-16): Core metrics container with two atomic counters
  - `remote_schedule_count`: Tracks tasks scheduled from outside the runtime
  - `budget_forced_yield_count`: Tracks tasks that yielded due to budget exhaustion
- `new()` constructor (L19-24): Creates instance with zero-initialized counters
- `inc_remote_schedule_count()` (L27-29): Atomically increments external scheduling counter
- `inc_budget_forced_yield_count()` (L32-34): Atomically increments budget yield counter

**Dependencies**:
- `MetricAtomicU64`: Custom atomic wrapper for metrics (from `crate::util::metric_atomics`)
- `Relaxed` memory ordering for atomic operations

**Design Patterns**:
- Atomic counters with relaxed ordering for performance metrics
- Crate-internal visibility (`pub(crate)`) for runtime internals
- Incremental API design with single-purpose methods

**Usage Context**: Part of Tokio's runtime observability system, enabling monitoring of scheduler behavior and task distribution patterns. The metrics help identify performance bottlenecks related to cross-thread scheduling and cooperative yielding.
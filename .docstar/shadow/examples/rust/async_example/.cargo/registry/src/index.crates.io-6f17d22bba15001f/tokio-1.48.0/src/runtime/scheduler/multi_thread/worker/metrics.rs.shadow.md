# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/multi_thread/worker/metrics.rs
@source-hash: 80b2a8cd89ccc540
@generated: 2026-02-09T17:57:16Z

**Purpose**: Metrics collection module for the multi-threaded runtime scheduler's worker, providing queue depth monitoring capabilities.

**Architecture**: Implements metric methods on the `Shared` struct (from parent module) to expose internal queue statistics for monitoring and debugging the task scheduler.

**Key Components**:
- `injection_queue_depth()` (L4-6): Returns the current depth of the global injection queue (`self.inject.len()`), which holds tasks that can be stolen by any worker thread
- `worker_local_queue_depth()` (L11-13): Conditionally compiled method that returns the depth of a specific worker's local steal queue (`self.remotes[worker].steal.len()`)

**Dependencies**:
- `super::Shared`: The shared scheduler state struct that contains the injection queue and worker remotes
- `cfg_unstable_metrics!`: Conditional compilation macro that gates unstable metrics features

**Architectural Patterns**:
- **Extension Pattern**: Adds metrics functionality to existing `Shared` struct via separate impl blocks
- **Feature Gating**: Uses conditional compilation to make certain metrics available only when unstable features are enabled
- **Zero-cost Abstractions**: Simple getter methods that directly expose underlying collection lengths

**Critical Invariants**:
- Worker index parameter in `worker_local_queue_depth()` must be valid (< `self.remotes.len()`)
- Queue depth metrics represent point-in-time snapshots and may change immediately after reading

**Usage Context**: These metrics are essential for runtime introspection, load balancing decisions, and performance monitoring in Tokio's work-stealing scheduler.
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/multi_thread/worker/metrics.rs
@source-hash: 80b2a8cd89ccc540
@generated: 2026-02-09T18:02:13Z

**Purpose**: Provides metrics functionality for the multi-threaded runtime scheduler's shared worker state. Exposes queue depth measurements for monitoring and debugging runtime performance.

**Core Components**:
- `injection_queue_depth()` (L4-6): Returns the current depth of the global injection queue by calling `self.inject.len()`. This queue is shared across all worker threads for task distribution.
- `worker_local_queue_depth()` (L11-13): **Conditionally compiled** method that returns the depth of a specific worker's local task queue via `self.remotes[worker].steal.len()`. Only available when unstable metrics feature is enabled.

**Dependencies**:
- Imports `Shared` from parent module (L1)
- Uses `cfg_unstable_metrics!` macro (L9) for conditional compilation of experimental metrics

**Architecture Notes**:
- Extends the `Shared` struct with metric collection capabilities through trait implementations
- Follows Tokio's pattern of feature-gating unstable APIs behind compile-time flags
- Provides read-only access to internal queue states without disrupting scheduler operations
- The `worker` parameter in `worker_local_queue_depth()` serves as an index into the `remotes` array

**Usage Context**: These metrics enable runtime introspection for performance monitoring, debugging task distribution patterns, and identifying potential bottlenecks in multi-threaded task scheduling.
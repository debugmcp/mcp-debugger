# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/metrics/mod.rs
@source-hash: 7380022f45d58ece
@generated: 2026-02-09T18:03:04Z

**Primary Purpose**: Module entry point for Tokio runtime performance metrics system. Provides conditional compilation structure for unstable metrics features, organizing metrics collection across different runtime components.

**Key Exports**:
- `RuntimeMetrics` (L12) - Public API for runtime performance data
- `MetricsBatch` (L15) - Internal batched metrics collection
- `WorkerMetrics` (L18) - Internal worker thread performance tracking

**Conditional Feature Architecture**:

*Unstable Metrics Enabled* (L20-35):
- `Histogram`, `HistogramBatch`, `HistogramBuilder` (L23) - Statistical data collection primitives
- Public histogram types: `HistogramScale`, `HistogramConfiguration`, `LogHistogram` etc. (L26)
- `SchedulerMetrics` (L29) - Task scheduler performance tracking
- `IoDriverMetrics` (L33) - Network I/O performance metrics (requires `net` feature)

*Unstable Metrics Disabled* (L37-40):
- `mock::SchedulerMetrics`, `mock::HistogramBuilder` (L39) - No-op implementations

**Architectural Patterns**:
- Conditional compilation using `cfg_unstable_metrics!` and `cfg_not_unstable_metrics!` macros
- Feature-gated modules (`cfg_net!` for networking metrics)
- Internal vs public API separation (crate-private vs public exports)
- Mock implementations when metrics disabled to maintain API compatibility

**Dependencies**: Relies on Tokio's configuration macros for conditional compilation and networking features.

**Critical Constraints**: 
- Unstable API with potential breaking changes in 1.x releases
- Networking metrics only available when `net` feature enabled
- Performance overhead considerations when metrics enabled vs disabled
# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/metrics/histogram.rs
@source-hash: ad85c830f2a3b9b5
@generated: 2026-02-09T18:03:08Z

**Primary Purpose**: Provides histogram data structures for Tokio runtime metrics, supporting both linear and logarithmic bucket scales for measuring duration-based performance metrics.

**Core Types**:
- `Histogram` (L14-22): Main histogram struct with atomic bucket counters (`MetricAtomicU64`) and histogram type configuration
- `HistogramBatch` (L48-51): Non-atomic accumulator for batch operations before submitting to main histogram
- `HistogramBuilder` (L25-28): Factory for creating histograms with configurable parameters
- `LegacyBuilder` (L31-35): Legacy configuration support for backward compatibility

**Histogram Types** (`HistogramType` enum, L100-109):
- `Linear`: Fixed-width buckets for uniform distribution
- `LogLegacy`: Legacy logarithmic scale where each bucket doubles in size
- `H2`: New H2 histogram implementation for logarithmic scaling

**Key Operations**:
- `value_to_bucket()` (L119-143): Maps measurement values to appropriate bucket indices using different algorithms per histogram type
- `bucket_range()` (L145-175): Returns the value range covered by a specific bucket
- `HistogramBatch::measure()` (L216-218): Accumulates measurements in batch before atomic submission
- `HistogramBatch::submit()` (L220-227): Atomically updates main histogram with batched values

**Configuration Structures**:
- `LinearHistogram` (L179-182): Configuration for fixed-width buckets
- `LegacyLogHistogram` (L185-188): Configuration for legacy logarithmic buckets
- `HistogramConfiguration` (L68-96): Public API for histogram configuration under `cfg_unstable`

**Dependencies**:
- `MetricAtomicU64` for thread-safe bucket counters
- `h2_histogram` module for advanced logarithmic histogram implementation
- `duration_as_u64` utility for time conversion

**Architecture Notes**:
- Batch-then-submit pattern minimizes atomic operations during measurement collection
- Multiple histogram implementations support different use cases and legacy compatibility
- Feature-gated public API (`cfg_unstable`) allows experimentation with histogram configurations
- Extensive test coverage (L286-629) validates bucket assignment and measurement accuracy

**Critical Invariants**:
- Bucket indices must be within bounds (clamped to `num_buckets - 1`)
- Batch and histogram must have matching configuration and bucket counts
- Last bucket always extends to `u64::MAX` for overflow values
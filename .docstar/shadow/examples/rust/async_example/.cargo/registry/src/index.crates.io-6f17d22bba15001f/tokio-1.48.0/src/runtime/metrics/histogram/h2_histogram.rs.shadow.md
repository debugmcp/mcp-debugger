# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/metrics/histogram/h2_histogram.rs
@source-hash: 3f8b25ab9805f9c2
@generated: 2026-02-09T17:58:25Z

## Purpose
Implements an H2 histogram data structure for Tokio's runtime metrics, providing efficient duration measurement with bounded error guarantees. This is a log-scaled histogram optimized for performance over HdrHistogram while maintaining error bounds of 2^-p.

## Core Components

### LogHistogram (L26-38)
Main histogram configuration struct with three key fields:
- `num_buckets` (L29): Total number of buckets in the histogram
- `p` (L32): Precision parameter controlling error bound (2^-p)  
- `bucket_offset` (L37): Number of initial buckets grouped into bucket 0 to increase minimum measurable value

Key methods:
- `from_n_p()` (L51-59): Creates histogram from mathematical parameters n and p
- `value_to_bucket()` (L80-85): Maps u64 values to bucket indices using H2 algorithm
- `bucket_range()` (L87-120): Returns the value range covered by a specific bucket
- `max_value()` (L76-78): Returns maximum storable value before truncation
- `truncate_to_max_value()` (L61-68): Reduces bucket count to fit within max value

### LogHistogramBuilder (L143-148)
Builder pattern for configuring histograms with optional fields:
- `max_value`: Maximum duration before values go to final bucket (default: 60s)
- `min_value`: Minimum measurable duration (default: 100ns)  
- `precision`: Error bound precision parameter (default: p=2, 25% max error)

Key methods:
- `max_error()` (L175-184): Sets precision based on maximum allowable error percentage
- `precision_exact()` (L200-204): Sets precision parameter p directly
- `min_value()` (L211-214): Sets minimum measurable duration  
- `max_value()` (L222-228): Sets maximum value before truncation
- `max_buckets()` (L231-242): Builds with bucket count validation
- `build()` (L245-257): Constructs the final LogHistogram

### Error Handling
`InvalidHistogramConfiguration` enum (L262-267) with `TooManyBuckets` variant for when bucket count exceeds limits.

## Key Algorithms

### H2 Histogram Implementation
The `bucket_index()` function (L284-297) implements the core H2 algorithm:
1. For values ≤ 2^p: direct value-to-bucket mapping
2. For larger values: logarithmic bucketing with precision control via bit manipulation

### Special Bucket Handling
- Bucket 0: Covers range [0, min_value) to truncate extremely short timescales
- Final bucket: Covers [max_value, u64::MAX] to handle outliers without rejection

## Dependencies
- `duration_as_u64` from `crate::runtime::metrics::batch` for Duration conversion
- Standard library components for duration handling and error types

## Configuration Defaults
- Minimum value: 100ns (L7)
- Maximum value: 60 seconds (L8) 
- Default precision: p=2 (25% max error) (L11)
- Maximum precision: p=10 (0.0977% error) (L12)
- Default configuration: 119 buckets (verified in tests L524)

## Architectural Decisions
1. Modified H2 implementation with special first/last bucket handling for practical duration measurement
2. Builder pattern for flexible configuration with validation
3. Bucket offset mechanism to reduce memory usage for high-precision histograms
4. Power-of-2 bucket sizing for efficient bit operations
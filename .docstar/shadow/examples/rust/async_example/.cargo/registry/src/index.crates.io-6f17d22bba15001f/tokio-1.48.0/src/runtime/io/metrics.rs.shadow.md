# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/io/metrics.rs
@source-hash: 734623b74777fa56
@generated: 2026-02-09T18:03:03Z

## Primary Purpose
Provides mock implementations of I/O driver metrics types for Tokio's runtime when full runtime features are disabled but networking is enabled.

## Architecture & Design
This file uses conditional compilation to provide either mock implementations or re-exports of real metrics types based on feature flags:

- **Mock Implementation (L7-16)**: When `rt`, `metrics`, and `net` features have specific combinations, provides no-op mock
- **Real Implementation Re-export (L18-24)**: When both `net` and `rt` features are enabled with unstable metrics, re-exports actual metrics

## Key Components

### IoDriverMetrics Mock Struct (L8-15)
- **Purpose**: No-op implementation when runtime metrics aren't available
- **Methods**:
  - `incr_fd_count()` (L12): Empty implementation for file descriptor count increment
  - `dec_fd_count()` (L13): Empty implementation for file descriptor count decrement  
  - `incr_ready_count_by()` (L14): Empty implementation for ready event count increment
- **Trait Implementations**: `Default` (L8)

### Conditional Compilation Strategy
- `cfg_not_rt_and_metrics_and_net!` (L7): Macro controlling when mocks are compiled
- `cfg_net!` + `cfg_rt!` + `cfg_unstable_metrics!` (L18-22): Nested feature flags for real implementation access

## Dependencies
- `crate::runtime::IoDriverMetrics` (L21): Real metrics implementation when available

## Critical Design Decisions
- **Separation from main mock module**: Located separately from `src/runtime/mock.rs` to be available when `net` is enabled without `rt`
- **Feature flag granularity**: Fine-grained conditional compilation allows precise control over when mocks vs real implementations are used
- **No-op pattern**: Mock methods accept parameters but perform no operations, maintaining API compatibility
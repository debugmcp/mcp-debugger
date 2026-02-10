# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/metric_atomics.rs
@source-hash: c123d1317a65138d
@generated: 2026-02-09T18:06:50Z

**Primary Purpose**: Platform-agnostic atomic metric counters for Tokio's internal telemetry system, providing safe fallbacks on platforms without 64-bit atomics.

**Key Components**:

- **MetricAtomicU64 (L12-47)**: Conditional 64-bit atomic counter that degrades gracefully on platforms without 64-bit atomic support
  - Only contains `AtomicU64` field on platforms with 64-bit atomics (L13-14)
  - `load()` method (L22-24): Only available with 64-bit atomics via `cfg_64bit_metrics!` macro
  - `store()/add()/new()` methods (L28-38): Full implementation on 64-bit platforms
  - No-op implementations (L42-46): Stub methods that do nothing on platforms without 64-bit atomics
  - Uses `#[allow(dead_code)]` (L18) as some methods are only used behind unstable feature flags

- **MetricAtomicUsize (L54-81)**: Standard atomic usize wrapper for metrics
  - Always available since usize atomics are universally supported
  - Provides standard atomic operations: `new()`, `load()`, `store()`, `increment()`, `decrement()`
  - Uses relaxed ordering for increment/decrement operations (L75, L79)
  - Marked with conditional `#[allow(dead_code)]` for non-unstable builds (L49, L58)

**Dependencies**:
- `std::sync::atomic::{AtomicUsize, Ordering}` (L1)
- Conditionally imports `AtomicU64` via `cfg_64bit_metrics!` macro (L3-5)

**Architectural Decisions**:
- Uses Tokio's conditional compilation macros (`cfg_64bit_metrics!`, `cfg_no_64bit_metrics!`) to handle platform differences
- Deliberately uses `std::sync` instead of Loom for metrics to avoid polluting Loom logs (L52)
- No-op implementations ensure code compiles and runs on all platforms without runtime checks
- Crate-internal visibility (`pub(crate)`) for all public interfaces

**Critical Invariants**:
- On platforms without 64-bit atomics, MetricAtomicU64 becomes a zero-sized type with no-op methods
- Load operations for MetricAtomicU64 are only available on platforms with 64-bit atomic support
- All metric operations are designed to be non-blocking and suitable for high-frequency telemetry
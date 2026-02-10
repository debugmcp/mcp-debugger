# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/time/handle.rs
@source-hash: 1ecbebdc070477d6
@generated: 2026-02-09T18:03:12Z

**Primary Purpose:** Handle to Tokio's time driver instance, providing access to time source and driver state management.

**Core Structure:**
- `Handle` struct (L5-8): Contains time source and inner driver reference
  - `time_source: TimeSource` - time source for duration calculations
  - `inner: super::Inner` - reference to shared driver state

**Key Methods:**
- `time_source()` (L12-14): Returns reference to associated TimeSource
- `is_shutdown()` (L17-19): Checks if time driver has been shutdown by delegating to inner driver
- `unpark()` (L22-27): Tracks driver unpark events, with test-only atomic wake tracking

**Conditional Implementation:**
- `current()` (L52-54): Available only when `rt` feature disabled (`cfg_not_rt!`)
  - Always panics with context missing error
  - Extensive documentation explains panic conditions related to runtime context

**Dependencies:**
- `TimeSource` from `crate::runtime::time`
- `super::Inner` (time driver inner state)
- Uses `std::sync::atomic::Ordering::SeqCst` for test wake tracking

**Architectural Notes:**
- Visibility carefully controlled with `pub(crate)` and `pub(super)`
- Feature-gated functionality for test utilities and runtime configurations
- Debug implementation (L58-62) provides minimal output ("Handle")
- `#[track_caller]` on `current()` for better panic location reporting

**Usage Pattern:** This handle serves as a lightweight reference to the time driver, allowing timer-related operations to access time source and check driver state without direct coupling to the full driver implementation.
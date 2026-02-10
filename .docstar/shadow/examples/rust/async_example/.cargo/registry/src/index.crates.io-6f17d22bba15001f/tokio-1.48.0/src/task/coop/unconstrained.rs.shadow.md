# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/task/coop/unconstrained.rs
@source-hash: f7bc110cea713696
@generated: 2026-02-09T18:03:22Z

**Primary Purpose**: Provides a Future wrapper that disables Tokio's cooperative task scheduling, allowing wrapped futures to run without being forced to yield.

**Key Components**:
- `Unconstrained<F>` struct (L10-13): Generic wrapper around any Future type F, using pin_project for safe pinning
- `Future` implementation (L16-35): Conditionally compiled poll methods based on cooperative scheduling feature
- `unconstrained()` constructor function (L43-44): Creates Unconstrained wrapper instances

**Implementation Details**:
- Uses `pin_project_lite` for safe pinning of inner Future field
- Conditional compilation via `cfg_coop!` and `cfg_not_coop!` macros:
  - With coop: calls `crate::task::coop::with_unconstrained()` to bypass scheduling limits (L25)
  - Without coop: directly forwards poll calls to inner future (L32)
- `#[must_use]` attribute prevents accidental dropping without polling

**Dependencies**:
- `pin_project_lite` for projection macro
- `crate::task::coop` module for unconstrained execution context (when cooperative scheduling enabled)
- Standard library Future traits and types

**Critical Behavior**:
- **Warning**: Can cause task starvation if wrapped future never yields voluntarily
- Bypasses Tokio's fairness mechanisms that prevent monopolization of executor threads
- Should only be used when certain the wrapped future will yield appropriately

**Architectural Pattern**:
- Zero-cost abstraction when cooperative scheduling disabled
- Runtime behavior modification through compile-time feature flags
- Transparent Future wrapper maintaining type safety
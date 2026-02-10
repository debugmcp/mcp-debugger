# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/future/block_on.rs
@source-hash: 30bad79b005a1ba7
@generated: 2026-02-09T18:06:30Z

**Primary Purpose**: Provides conditional `block_on` implementation for executing async futures synchronously, with different strategies based on runtime compilation features.

**Key Function**:
- `block_on<F: Future>(f: F) -> F::Output` (L5-13, L18-21): Core blocking function that executes a future to completion synchronously, with two conditional implementations

**Conditional Compilation Branches**:
- **Runtime enabled (`cfg_rt!`)** (L3-14): Uses runtime context's blocking region mechanism
  - Calls `crate::runtime::context::try_enter_blocking_region()` (L6-11) with detailed error message for nested blocking attempts
  - Uses runtime's `block_on` method (L12)
- **Runtime disabled (`cfg_not_rt!`)** (L16-22): Uses cached park thread for blocking
  - Creates `CachedParkThread` instance (L19)
  - Uses park thread's `block_on` method (L20)

**Dependencies**:
- `std::future::Future` for async trait
- `crate::runtime::context` (runtime-enabled path)
- `crate::runtime::park::CachedParkThread` (runtime-disabled path)

**Key Characteristics**:
- Both functions marked with `#[track_caller]` for better error reporting
- Both implementations use `.unwrap()` assuming infallible operation
- Provides clear error messaging for invalid nested blocking scenarios
- Uses conditional compilation to optimize for different runtime configurations

**Invariants**:
- Function must not be called from within an async runtime context (runtime-enabled version)
- Future must complete successfully (both versions panic on error via `.unwrap()`)
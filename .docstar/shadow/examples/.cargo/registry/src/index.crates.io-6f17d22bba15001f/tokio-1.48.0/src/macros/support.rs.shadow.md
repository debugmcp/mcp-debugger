# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/macros/support.rs
@source-hash: f2b4593b96532e81
@generated: 2026-02-09T18:06:36Z

## Purpose
Support module for Tokio macros, providing essential utilities and re-exports needed by macro-generated code. Acts as a bridge between macro expansions and internal Tokio functionality.

## Key Components

### Re-exports (L2-6, L30-32)
- `maybe_done` (L2): Future utility from `crate::future::maybe_done`
- `poll_fn` (L4): Standard library future polling function
- Join/select utilities (L6): `BiasedRotator`, `Rotator`, `RotatorSelect`, `SelectNormal`, `SelectBiased` from internal join macros
- Standard future traits (L30-32): `Future`, `IntoFuture`, `Pin`, `Context`, `Poll`

### Utility Functions

#### Random Number Generation
- `thread_rng_n(n: u32) -> u32` (L9-11): Hidden utility that delegates to runtime context for thread-local random number generation

#### Budget Management (Conditional Compilation)
- **With cooperation** (`cfg_coop`, L14-19): `poll_budget_available(cx: &mut Context<'_>) -> Poll<()>` delegates to `crate::task::coop::poll_budget_available` for actual budget checking
- **Without cooperation** (`cfg_not_coop`, L21-27): Same signature but always returns `Poll::Ready(())`, effectively disabling budget enforcement

## Architectural Decisions
- Uses conditional compilation (`cfg_macros!`, `cfg_coop!`, `cfg_not_coop!`) to adapt functionality based on feature flags
- All functions marked `#[doc(hidden)]` to keep them internal to macro implementations
- Provides no-op budget checking when cooperation is disabled, maintaining API compatibility

## Dependencies
- Internal Tokio modules: `runtime::context`, `task::coop`, `future::maybe_done`, `macros::join`
- Standard library: `std::future`, `std::pin`, `std::task`

## Usage Context
This module is specifically designed for consumption by Tokio's procedural macros, providing the necessary building blocks for `join!`, `select!`, and other async coordination macros.
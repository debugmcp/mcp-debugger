# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/macros/join.rs
@source-hash: 117f448e7210b502
@generated: 2026-02-09T18:06:40Z

**Purpose**: Implements the `join!` macro for Tokio's async runtime, enabling concurrent execution of multiple futures on a single task with configurable polling fairness.

## Core Components

**`doc!` macro (L1-107)**: Documentation wrapper that applies comprehensive rustdoc to the actual `join!` implementation. Contains detailed usage examples and behavioral explanations.

**`join!` macro implementation (L115-227)**: Complex recursive macro with multiple entry points:
- Entry points (L216-226): Handle `biased;` vs normal mode and empty cases
- Normalization phase (L211-213): Transforms input expressions into internal representation
- Core implementation (L116-207): Generates polling logic with rotator-based fairness

**Rotator system (L229-282)**:
- `RotatorSelect` trait (L232-234): Allows compile-time selection of rotation strategy
- `SelectNormal` (L238-247): Enables fair rotation between futures
- `SelectBiased` (L242-251): Forces sequential polling from first to last
- `Rotator<COUNT>` (L254-270): Cycles through futures 0..COUNT-1 for fairness
- `BiasedRotator` (L273-282): Always returns 0 to maintain declaration order

## Key Mechanisms

**Polling Strategy**: Uses `poll_fn` with rotator to control which future gets polled first each wake cycle. In normal mode, rotates starting position to prevent starvation. In biased mode, always starts from first future.

**Memory Safety**: Employs `Pin::new_unchecked` with stack-allocated futures tuple, ensuring futures never move. Uses `maybe_done` wrapper to track completion state.

**Macro Expansion Flow**: 
1. Entry point determines rotator type (`SelectNormal` vs `SelectBiased`)
2. Normalization phase builds counting metadata and expression list
3. Core implementation generates polling loop with rotator logic

## Dependencies
- `$crate::macros::support`: Provides `maybe_done`, `poll_fn`, `Future`, `Pin`, `RotatorSelect`
- Standard `Poll` enum for async state management

## Architecture Notes
- Zero-allocation design using stack-allocated tuple of futures
- Compile-time const generic `COUNT` for rotator bounds
- Macro hygiene preserved through qualified paths (`$crate::`)
- Fair scheduling prevents single future from consuming entire poll budget
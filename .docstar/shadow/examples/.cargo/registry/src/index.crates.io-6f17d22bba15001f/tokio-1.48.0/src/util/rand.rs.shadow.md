# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/rand.rs
@source-hash: d37c69d14920db88
@generated: 2026-02-09T18:06:51Z

## Purpose
Provides random number generation utilities for the Tokio runtime, implementing a fast xorshift64+ algorithm for deterministic and efficient random number generation within async contexts.

## Key Types

### RngSeed (L16-19)
- Represents a seed for deterministic random number generation
- Contains two u32 fields (`s`, `r`) for the xorshift state
- Primary constructor `new()` (L36-38) uses loom's entropy source
- `from_u64()` (L40-50) converts 64-bit seed into two 32-bit components, ensuring non-zero state
- Enables reproducible runtime behavior when determinism is required

### FastRand (L29-32) 
- Fast random number generator implementing xorshift64+ algorithm
- Maintains two u32 state values (`one`, `two`)
- Core algorithm based on Marsaglia's xorshift paper with shift triplet [17,7,16]
- Passes SmallCrush test suite for statistical quality

## Key Functions

### FastRand Methods
- `new()` (L59-61): Creates generator with default entropy
- `from_seed()` (L64-69): Creates deterministic generator from RngSeed
- `fastrand()` (L83-94): Core xorshift64+ implementation, returns u32
- `fastrand_n()` (L76-81): Bounded random using fast modulo reduction technique

## Dependencies
- `crate::loom::rand::seed()` for entropy source
- Conditional compilation via `cfg_rt!` and `cfg_unstable!` macros
- Runtime module `rt` containing `RngSeedGenerator`

## Architecture Notes
- Uses conditional compilation to include runtime-specific components
- `fastrand_n()` available only with specific feature combinations (macros, rt-multi-thread, sync+rt)
- Implements Lemire's fast modulo reduction to avoid division
- Zero-state protection in seed generation (ensures `two != 0`)

## Critical Invariants
- Second state value (`two`/`r`) must never be zero for proper xorshift operation
- State updates must maintain both components for algorithm correctness
- Generator state mutated on each call, requiring mutable access
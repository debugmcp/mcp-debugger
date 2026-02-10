# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/rand/rt.rs
@source-hash: 9790a2b6d822edbf
@generated: 2026-02-09T18:03:21Z

## Purpose
Thread-safe deterministic seed generation for Tokio's random number infrastructure. Provides a mutex-wrapped FastRand generator for creating reproducible sequences of RNG seeds across multiple threads.

## Key Components

### RngSeedGenerator (L14-45)
Thread-safe wrapper around FastRand for deterministic seed generation:
- **state** (L17): Mutex<FastRand> - Thread-safe internal RNG state
- **new()** (L22-26): Constructor taking initial RngSeed
- **next_seed()** (L29-39): Generates next RngSeed by calling fastrand() twice and combining results
- **next_generator()** (L42-44): Creates new RngSeedGenerator using next seed in sequence

### FastRand Extension (L47-61)
Additional method for the FastRand type:
- **replace_seed()** (L53-60): Swaps RNG state with new seed, returns previous state as RngSeed

## Dependencies
- `super::{FastRand, RngSeed}` - Core RNG types from parent module
- `std::sync::Mutex` - Thread synchronization

## Architecture Notes
- Design optimized for infrequent seed generation to minimize mutex overhead
- Deterministic: same initial seed produces identical sequence
- Thread-safe through mutex, unlike thread-local FastRand instances
- Seeds generated using pair of fastrand() calls for increased entropy

## Usage Context
Intended for runtime-level seed management where thread safety is required but generation frequency is low, contrasting with high-frequency thread-local RNG usage patterns.
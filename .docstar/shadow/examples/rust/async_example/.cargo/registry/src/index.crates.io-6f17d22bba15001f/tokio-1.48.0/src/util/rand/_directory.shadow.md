# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/rand/
@generated: 2026-02-09T18:16:05Z

## Purpose
This directory provides runtime-level random number generation utilities for Tokio's async runtime, focusing on thread-safe, deterministic seed management and generation. It complements the main `util/rand` module by offering specialized functionality for multi-threaded runtime environments where reproducible randomness is required.

## Key Components

### Core Seed Management (`rt.rs`)
- **RngSeedGenerator**: Thread-safe deterministic seed generator using mutex-wrapped FastRand
  - Generates reproducible sequences of RNG seeds across threads
  - Optimized for infrequent generation to minimize mutex overhead
  - Provides `next_seed()` and `next_generator()` for seed sequence management
- **FastRand Extension**: Adds `replace_seed()` method for state swapping operations

### Byte-Based Seeding (`rt_unstable.rs`)
- **RngSeed::from_bytes**: Converts arbitrary byte data into deterministic RNG seeds
  - Uses hash-based approach via DefaultHasher for good distribution properties
  - Enables seeding from configuration data, string literals, or other byte sequences
  - Part of unstable runtime API for advanced use cases

## Public API Surface
**Primary Entry Points:**
- `RngSeedGenerator::new(seed)` - Create thread-safe seed generator
- `RngSeedGenerator::next_seed()` - Generate next seed in deterministic sequence
- `RngSeed::from_bytes(bytes)` - Create seed from arbitrary byte data

## Internal Organization
The module is organized around two complementary approaches:
1. **Thread-safe sequential generation** - For runtime components needing coordinated seed sequences
2. **Flexible seed initialization** - For creating seeds from external data sources

Both components leverage the core `FastRand` and `RngSeed` types from the parent `util/rand` module, extending them with runtime-specific functionality.

## Data Flow
```
External bytes → hash → u64 → RngSeed → RngSeedGenerator → deterministic seed sequence
```

## Important Patterns
- **Deterministic reproducibility**: Same input always produces identical output
- **Thread-safe coordination**: Mutex-based synchronization for multi-threaded access
- **Hash-based distribution**: Ensures good randomness properties from arbitrary input
- **Layered architecture**: Builds upon core RNG primitives with runtime-specific extensions

## Usage Context
Designed for Tokio runtime internals where deterministic, thread-safe random number generation is required, particularly for testing scenarios and applications needing reproducible async behavior across multiple threads.
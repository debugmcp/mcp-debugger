# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/rand/rt_unstable.rs
@source-hash: bdb69915fe12a9e0
@generated: 2026-02-09T18:03:19Z

**Purpose**: Extends the `RngSeed` type with byte-based seed generation functionality for Tokio's runtime random number generation system.

**Key Implementation**:
- `RngSeed::from_bytes` (L15-18): Converts arbitrary byte slices into deterministic RNG seeds using `DefaultHasher`
- Uses hash-based approach: bytes → hash → u64 → RngSeed conversion chain
- Leverages existing `Self::from_u64()` method for final seed construction

**Dependencies**:
- `super::RngSeed`: Core seed type from parent module
- `std::collections::hash_map::DefaultHasher`: Standard library hasher for deterministic conversion
- `std::hash::Hasher`: Trait providing hash computation interface

**Architecture Notes**:
- Implements deterministic seeding: identical input bytes always produce the same seed
- Hash-based approach ensures good distribution properties for RNG seeding
- Part of Tokio's unstable runtime API (indicated by `rt_unstable` module name)

**Usage Pattern**: Enables creation of reproducible RNG seeds from string literals, configuration data, or other byte sequences for testing and deterministic behavior in async runtimes.
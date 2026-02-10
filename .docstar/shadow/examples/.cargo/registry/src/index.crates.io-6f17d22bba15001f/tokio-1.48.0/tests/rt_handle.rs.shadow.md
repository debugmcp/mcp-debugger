# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/rt_handle.rs
@source-hash: 351e99d5d6fbd3b2
@generated: 2026-02-09T18:12:27Z

## Purpose
Test suite for Tokio runtime handle management, focusing on runtime context entering/exiting behavior, task lifecycle management, and runtime identification. Tests critical invariants around nested runtime contexts and memory safety with cyclic task references.

## Key Test Functions

### Runtime Enter/Exit Tests
- **`basic_enter` (L8-19)**: Validates proper nested entering of multiple runtime contexts with correct LIFO cleanup order
- **`interleave_enter_different_rt` (L21-33)**: [Should panic] Tests that interleaved drops of different runtime enters are invalid and trigger panic
- **`interleave_enter_same_rt` (L35-47)**: [Should panic] Tests that interleaved drops within same runtime context are invalid
- **`interleave_then_enter` (L49-67)**: Validates runtime recovery after panic - ensures new runtime contexts can be entered after panic recovery

### Memory Safety Tests  
- **`drop_tasks_with_reference_cycle` (L69-101)**: Critical memory leak test using circular JoinHandle references with barriers for synchronization. Tests that Tokio properly handles cyclic task dependencies without leaking memory (Miri detection)

### Runtime ID Tests (Unstable Feature)
- **`unstable::runtime_id_is_same` (L107-115)**: Validates that multiple handles from same runtime have identical IDs
- **`unstable::runtime_ids_different` (L117-123)**: Validates that different runtimes have unique IDs

## Helper Functions
- **`rt` (L126-130)**: Factory function creating single-threaded current-thread runtime instances

## Dependencies
- `tokio::runtime::Runtime` - Core runtime functionality
- `tokio::sync::{mpsc, Barrier}` - Async synchronization primitives  
- `std::sync::Arc` - Reference counting for shared barrier
- `futures` crate - For `select` combinator in cycle test

## Architectural Patterns
- Uses `#[should_panic]` attribute to test runtime invariant violations
- Platform-specific conditional compilation (`cfg_attr`, `cfg(not(target_os = "wasi"))`)
- Feature gating for unstable APIs (`#[cfg(tokio_unstable)]`)
- Panic recovery testing with `std::panic::catch_unwind`

## Critical Invariants
1. Runtime enter contexts must be dropped in LIFO order
2. Interleaved dropping of runtime contexts from different runtimes causes panic
3. Cyclic task references must not cause memory leaks
4. Runtime recovery possible after context panic
5. Runtime IDs are consistent per runtime instance but unique across instances
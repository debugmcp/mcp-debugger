# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot-0.12.5/src/mutex.rs
@source-hash: b7ee456958a3b0dc
@generated: 2026-02-09T18:11:43Z

## Purpose
Re-exports and utilities for parking_lot's high-performance Mutex implementation. This file provides a type-safe wrapper around `RawMutex` using the `lock_api` crate, offering a drop-in replacement for `std::sync::Mutex` with improved performance characteristics.

## Key Types & Functions

**Mutex<T> (L86)**: Type alias for `lock_api::Mutex<RawMutex, T>` - the main mutex type that protects data of type T.

**const_mutex<T>(val: T) (L91-93)**: Const constructor function enabling mutex creation in constant contexts on stable Rust. Creates unlocked mutex with initial value.

**MutexGuard<'a, T> (L100)**: Type alias for RAII lock guard that automatically unlocks on drop. Provides `Deref`/`DerefMut` access to protected data.

**MappedMutexGuard<'a, T> (L109)**: Type alias for guard returned by mapping operations, points to subfields of protected data. Cannot be temporarily unlocked for soundness.

## Architecture & Dependencies

- **Core dependency**: `RawMutex` from `crate::raw_mutex` (L8) - provides the low-level locking primitive
- **Lock API integration**: Uses `lock_api` crate for generic mutex interface, allowing consistent API across different raw mutex implementations
- **No poisoning model**: Unlike std::sync::Mutex, does not poison on panic

## Key Features Highlighted in Documentation

- **Eventual fairness**: Automatic fair unlocks every 0.5ms and for critical sections >1ms (L27-34)
- **Space efficiency**: Only 1 byte overhead vs std::sync::Mutex boxing (L42)
- **Performance optimizations**: Inline fast path, adaptive spinning for micro-contention (L46-47)
- **Static construction**: Can be created at compile time (L44)
- **Optional fair unlocking**: Via `MutexGuard::unlock_fair` (L36, L50)

## Test Coverage
Comprehensive test suite (L111-385) covers:
- Basic locking/unlocking (L133-137)
- High-contention scenarios (L140-173) 
- Guard mapping operations (L314-384)
- Condvar integration (L213-233)
- Panic safety (L252-270)
- Serialization with serde feature (L302-312)
- Debug formatting (L293-299)

## Critical Invariants
- Data access only possible through RAII guards ensuring exclusive access
- No manual memory management required (no drop glue)
- Thread-safe sharing via Arc<Mutex<T>> pattern
- Guards maintain lock until explicit drop or scope exit
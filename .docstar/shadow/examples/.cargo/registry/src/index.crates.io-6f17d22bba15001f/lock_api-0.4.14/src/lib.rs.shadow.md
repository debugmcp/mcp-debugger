# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/lock_api-0.4.14/src/lib.rs
@source-hash: f6dfe0a321e47b5e
@generated: 2026-02-09T18:11:31Z

## Primary Purpose

Root library module for `lock_api` crate - provides type-safe wrapper abstractions over raw lock implementations. Enables generic lock programming by separating lock state from protected data and providing extensible trait system for custom lock types.

## Key Types and Exports

**Guard Marker Types:**
- `GuardSend` (L100): Zero-sized marker indicating lock guards can be sent across threads
- `GuardNoSend` (L104): Non-Send marker with raw pointer field, implements `Sync` (L106)

**Module Structure:**
- `mutex` module (L108-109): Core mutex implementation and traits
- `remutex` module (L111-114): Recursive mutex, gated by `atomic_usize` feature
- `rwlock` module (L116-117): Reader-writer lock implementation and traits

## Architecture Pattern

The crate follows a trait-based abstraction pattern:
1. Raw lock types implement base traits (`RawMutex`, `RawRwLock`)
2. Generic wrapper types (`Mutex<R, T>`, `RwLock<R, T>`) provide safe interface
3. Extension traits add optional functionality (timeouts, fairness, recursion, etc.)
4. Guard marker types control Send/Sync behavior at compile time

## Feature Flags

- `arc_lock` (L96-97): Enables Arc-based locking, requires `alloc` crate
- `atomic_usize` (L111-113): Enables recursive mutex functionality
- `owning_ref`: Mentioned in docs for `owning_ref` crate integration

## Critical Design Elements

- No-std compatible (L88) with optional `alloc` dependency
- Uses `scopeguard` for RAII cleanup patterns (L94)
- Type-level enforcement of thread safety through marker types
- Extensible design allowing lock implementors to opt into additional features
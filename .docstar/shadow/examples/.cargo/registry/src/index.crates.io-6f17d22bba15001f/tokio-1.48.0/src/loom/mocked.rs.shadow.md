# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/loom/mocked.rs
@source-hash: 44a631281f362d6b
@generated: 2026-02-09T18:06:39Z

## Primary Purpose
This file provides mocked implementations of synchronization primitives and system utilities for testing Tokio under the `loom` testing framework. It serves as a compatibility layer that wraps loom's testing infrastructure to provide consistent interfaces for concurrent code testing.

## Key Components

### Sync Module (L3-68)
- **Mutex<T> (L8-27)**: Wrapper around `loom::sync::Mutex` providing standard mutex operations
  - `new()` (L13-15): Constructor wrapping loom mutex
  - `lock()` (L19-21): Blocking lock with panic on poison (uses `unwrap()`)
  - `try_lock()` (L24-26): Non-blocking lock attempt, converts errors to `None`
- **RwLock<T> (L30-58)**: Wrapper around `loom::sync::RwLock` for reader-writer locks
  - `new()` (L35-37): Constructor wrapping loom RwLock
  - `read()`/`write()` (L40-42, L50-52): Blocking read/write access with panic on poison
  - `try_read()`/`try_write()` (L45-47, L55-57): Non-blocking access attempts
- **Guard Types (L5)**: Re-exports loom's guard types for lock ownership
- **Atomic Module (L62-67)**: Re-exports loom atomics with fallback to std for `StaticAtomicU64`

### System Mocks (L70-85)
- **rand::seed() (L71-73)**: Returns fixed seed value `1` for deterministic testing
- **sys::num_cpus() (L77-79)**: Returns fixed value `2` for consistent test environment
- **thread module (L82-85)**: Re-exports loom's thread primitives and lazy_static support

## Dependencies
- **loom crate**: Primary dependency for all mocked functionality, providing deterministic concurrency testing
- **std::sync::atomic**: Fallback for `StaticAtomicU64` where loom version unavailable

## Architectural Patterns
- **Wrapper Pattern**: All sync primitives wrap loom equivalents with simplified error handling
- **Panic-on-Error**: Lock operations use `.unwrap()` assuming poisoning shouldn't occur in tests
- **Fixed Values**: System queries return constants for reproducible test conditions
- **Re-export Strategy**: Extensive use of `pub(crate) use` to provide unified interface

## Critical Constraints
- Designed exclusively for testing environments under loom
- Error handling assumes non-poisoned locks (panics on poison)
- System values are hardcoded for deterministic behavior
- All visibility is crate-internal (`pub(crate)`)
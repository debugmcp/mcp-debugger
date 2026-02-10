# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot-0.12.5/src/fair_mutex.rs
@source-hash: 2d0c5c2b77949265
@generated: 2026-02-09T18:11:40Z

A fair mutex implementation that provides always-fair locking semantics through FIFO ordering, built on top of the `lock_api` crate.

## Primary Purpose
Provides a mutual exclusion primitive that guarantees fairness by maintaining a FIFO queue of waiting threads, preventing starvation scenarios where one thread repeatedly acquires the lock.

## Core Types

**FairMutex<T>** (L77): Type alias for `lock_api::Mutex<RawFairMutex, T>` - the main fair mutex type that wraps any data type T with always-fair locking semantics.

**FairMutexGuard<'a, T>** (L91): RAII guard type alias providing exclusive access to mutex data with automatic unlock on drop via `Deref`/`DerefMut`.

**MappedFairMutexGuard<'a, T>** (L100): Specialized guard for subfields of protected data, created through mapping operations but without unlock/relock capabilities.

## Key Functions

**const_fair_mutex<T>()** (L82-84): Creates a const-constructible fair mutex, enabling static initialization in const contexts.

## Implementation Details

- **No poisoning**: Lock is released normally on panic, unlike std library mutexes
- **Minimal footprint**: Only 1 byte of storage vs boxed std implementation
- **FIFO fairness**: Waiters form queue with lock granted to next in line (L24-27)
- **Performance features**: Adaptive spinning for micro-contention, inline fast path
- **Raw lock support**: Allows locking/unlocking without guards

## Dependencies
- `crate::raw_fair_mutex::RawFairMutex` (L8): Provides the underlying raw fair mutex implementation
- `lock_api` crate: Core mutex abstractions and guard types

## Fairness vs Performance Trade-offs
Documentation notes that fair mutexes are generally slower than regular mutexes but prevent thread starvation. May cause priority inversion issues when threads have different priorities (L29-30).

## Test Coverage
Comprehensive test suite (L102-274) covering basic operations, concurrency stress tests, panic safety, serialization, and debug formatting. Tests verify fairness properties and proper cleanup behavior.
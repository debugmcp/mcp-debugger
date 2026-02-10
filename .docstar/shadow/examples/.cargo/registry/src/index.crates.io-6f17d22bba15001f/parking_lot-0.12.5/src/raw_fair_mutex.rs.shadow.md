# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot-0.12.5/src/raw_fair_mutex.rs
@source-hash: 316f954d9673ac5b
@generated: 2026-02-09T18:11:37Z

## Purpose
Provides a fair mutex implementation that wraps `RawMutex` to ensure fairness in lock acquisition ordering. Acts as a thin wrapper that delegates most operations to the underlying `RawMutex` while overriding the unlock behavior to use fair unlocking.

## Key Structure
- **RawFairMutex (L12)**: Newtype wrapper around `RawMutex` that implements fair locking semantics

## Core Trait Implementations

### lock_api::RawMutex (L14-38)
- **INIT constant (L15)**: Initialization constant delegated to wrapped RawMutex
- **GuardMarker type (L17)**: Type alias for the underlying mutex's guard marker
- **lock() (L20-22)**: Standard blocking lock, delegates to inner mutex
- **try_lock() (L25-27)**: Non-blocking lock attempt, delegates to inner mutex
- **unlock() (L30-32)**: **Critical difference** - calls `unlock_fair()` instead of regular unlock
- **is_locked() (L35-37)**: Lock status check, delegates to inner mutex

### lock_api::RawMutexFair (L40-50)
- **unlock_fair() (L42-44)**: Fair unlocking that maintains FIFO ordering of waiting threads
- **bump() (L47-49)**: Priority adjustment operation, delegates to inner mutex

### lock_api::RawMutexTimed (L52-65)
- **Duration/Instant types (L53-54)**: Time-related type aliases from wrapped mutex
- **try_lock_until() (L57-59)**: Timeout-based locking with absolute deadline
- **try_lock_for() (L62-64)**: Timeout-based locking with relative duration

## Dependencies
- `crate::raw_mutex::RawMutex`: The underlying mutex implementation being wrapped
- `lock_api`: External crate providing mutex trait definitions

## Architectural Pattern
Classic newtype wrapper pattern that modifies specific behavior (fair unlocking) while preserving the interface and delegating most functionality. The key behavioral difference is in the `unlock()` method (L31) which calls `unlock_fair()` to ensure fairness guarantees.
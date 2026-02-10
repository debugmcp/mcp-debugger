# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/loom/std/mutex.rs
@source-hash: 0ffb1cfcce8b931f
@generated: 2026-02-09T18:02:55Z

## Mutex Wrapper for std::sync::Mutex

This file provides a non-poisoning wrapper around `std::sync::Mutex` within Tokio's loom compatibility layer. Located in the `std` subdirectory, this is the standard library implementation (as opposed to loom's testing implementation).

### Primary Purpose
- **Poison-free mutex abstraction**: Wraps `std::sync::Mutex` to eliminate poison handling from the API surface
- **Tokio internal synchronization**: Provides consistent mutex behavior across Tokio's codebase without exposing poison errors

### Key Components

**Mutex<T> struct (L6)**: 
- Newtype wrapper around `sync::Mutex<T>` 
- Implements `Debug` trait
- Uses `?Sized` bound for flexible typing
- Marked `pub(crate)` for internal Tokio use only

**Constructor methods (L11-18)**:
- `new(t: T) -> Mutex<T>` (L11): Standard constructor, inlined
- `const_new(t: T) -> Mutex<T>` (L16): Const constructor for compile-time initialization

**Locking methods (L21-35)**:
- `lock(&self) -> MutexGuard<'_, T>` (L21): Blocking lock that automatically recovers from poisoned state by extracting inner value (L24)
- `try_lock(&self) -> Option<MutexGuard<'_, T>>` (L29): Non-blocking lock that handles both poisoned (L32) and would-block (L33) cases

### Key Architectural Decisions
- **Poison recovery strategy**: Both lock methods automatically recover from poisoned mutexes by calling `into_inner()` on poison errors
- **Option-based try_lock**: Returns `None` only for `WouldBlock`, treating poisoned mutexes as recoverable
- **Zero-cost abstraction**: All methods are inlined and delegate directly to std implementation

### Dependencies
- `std::sync::{Mutex, MutexGuard, TryLockError}` for core mutex functionality
- Part of Tokio's loom abstraction layer for testing/runtime compatibility
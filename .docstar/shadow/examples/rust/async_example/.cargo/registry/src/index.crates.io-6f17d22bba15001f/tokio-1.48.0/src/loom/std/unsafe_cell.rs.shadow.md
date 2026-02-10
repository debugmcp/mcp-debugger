# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/loom/std/unsafe_cell.rs
@source-hash: 789497164c351a56
@generated: 2026-02-09T18:02:52Z

## Purpose
Thin wrapper around `std::cell::UnsafeCell<T>` providing a consistent interface for Tokio's loom testing framework. This is part of Tokio's standard library abstraction layer when not using loom for concurrency testing.

## Key Components

### UnsafeCell<T> (L2)
- Newtype wrapper around `std::cell::UnsafeCell<T>`
- Provides interior mutability with manual safety guarantees
- Debug-derivable for development visibility

### Core Methods
- `new(data: T)` (L5-7): Const constructor wrapping the inner UnsafeCell
- `with<R>(&self, f: impl FnOnce(*const T) -> R)` (L10-12): Provides read-only raw pointer access via closure
- `with_mut<R>(&self, f: impl FnOnce(*mut T) -> R)` (L15-17): Provides mutable raw pointer access via closure

## Dependencies
- `std::cell::UnsafeCell` - Core primitive for interior mutability

## Architectural Pattern
- **Abstraction Layer**: Standardizes UnsafeCell usage across Tokio's loom/non-loom configurations
- **Closure-based Safety**: Encapsulates raw pointer access within controlled scopes
- **Zero-cost Wrapper**: Inline functions ensure no runtime overhead

## Critical Invariants
- Caller must ensure memory safety when using raw pointers from `with` and `with_mut`
- Thread safety depends on usage context - UnsafeCell itself provides no synchronization
- Both access methods return the same underlying pointer via `get()`, differing only in mutability annotation
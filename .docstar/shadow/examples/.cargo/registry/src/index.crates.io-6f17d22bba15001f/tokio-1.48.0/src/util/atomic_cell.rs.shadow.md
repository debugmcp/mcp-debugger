# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/atomic_cell.rs
@source-hash: b1a2a0b1c0f891cd
@generated: 2026-02-09T18:06:46Z

**Purpose:** Thread-safe atomic cell implementation for optional boxed values using raw pointer atomics.

**Core Structure:**
- `AtomicCell<T>` (L6-8): Wrapper around `AtomicPtr<T>` providing safe atomic operations on `Option<Box<T>>`
- Single field `data: AtomicPtr<T>` stores raw pointer representation

**Key Methods:**
- `new(data: Option<Box<T>>)` (L14-18): Constructor converting optional box to raw pointer
- `swap(val: Option<Box<T>>) -> Option<Box<T>>` (L20-23): Atomic exchange operation using AcqRel ordering
- `set(val: Box<T>)` (L25-27): Convenience method for atomic store (discards old value)
- `take() -> Option<Box<T>>` (L29-31): Atomic extraction, leaves cell empty

**Utility Functions:**
- `to_raw<T>(data: Option<Box<T>>) -> *mut T` (L34-36): Converts `Option<Box<T>>` to raw pointer (null for None)
- `from_raw<T>(val: *mut T) -> Option<Box<T>>` (L38-44): Converts raw pointer back to `Option<Box<T>>` (unsafe reconstruction)

**Safety & Concurrency:**
- Manual `Send + Sync` implementation (L10-11) requires `T: Send`
- Uses AcqRel memory ordering for all atomic operations
- Drop implementation (L46-51) ensures cleanup of remaining data
- Raw pointer manipulation safely encapsulated within conversion functions

**Dependencies:**
- `crate::loom::sync::atomic::AtomicPtr` for atomic pointer operations
- Standard library for pointer utilities and atomic ordering

**Architectural Notes:**
- Provides higher-level interface over raw atomic pointers
- Memory management handled automatically through Box ownership transfer
- Suitable for lock-free data structures requiring atomic optional values
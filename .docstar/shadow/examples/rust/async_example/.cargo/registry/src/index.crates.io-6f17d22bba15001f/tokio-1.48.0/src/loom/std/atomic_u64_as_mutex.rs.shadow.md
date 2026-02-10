# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/loom/std/atomic_u64_as_mutex.rs
@source-hash: 1a6b9f8417e968a7
@generated: 2026-02-09T18:02:52Z

## Purpose
Fallback implementation of `AtomicU64` using a mutex when native atomic 64-bit operations are unavailable. This is part of Tokio's loom testing framework abstraction layer.

## Key Components

### AtomicU64 Struct (L16-19)
- Core structure wrapping a `Mutex<u64>` to simulate atomic operations
- Uses mutex locking to ensure thread-safe access to the underlying u64 value
- All atomic ordering parameters are ignored since mutex provides sequential consistency

### Atomic Operations (L21-70)
- **load** (L22-24): Returns current value by acquiring mutex lock
- **store** (L26-28): Sets new value by acquiring mutex lock  
- **fetch_add** (L30-35): Atomic add-and-return-previous operation via mutex
- **fetch_or** (L37-42): Atomic bitwise-or-and-return-previous operation via mutex
- **compare_exchange** (L44-59): Compare-and-swap operation with success/failure result
- **compare_exchange_weak** (L61-69): Delegates to strong compare_exchange (no spurious failures in mutex implementation)

### Static Initialization (L4-14)
Conditional compilation selects appropriate static initialization strategy:
- `atomic_u64_static_const_new.rs` for platforms with const mutex constructors
- `atomic_u64_static_once_cell.rs` for platforms requiring runtime initialization
- Exports `StaticAtomicU64` type from selected implementation

### Default Implementation (L72-76)
Standard Default trait creating zero-initialized AtomicU64.

## Dependencies
- `crate::loom::sync::Mutex` - Tokio's loom mutex abstraction
- `std::sync::atomic::Ordering` - Standard atomic ordering types (ignored in this implementation)

## Architectural Notes
- This is a compatibility shim for platforms lacking native 64-bit atomics
- All atomic ordering parameters are deliberately ignored since mutex provides strongest consistency
- Performance penalty compared to native atomics due to lock acquisition overhead
- Part of Tokio's platform abstraction allowing uniform atomic API across targets
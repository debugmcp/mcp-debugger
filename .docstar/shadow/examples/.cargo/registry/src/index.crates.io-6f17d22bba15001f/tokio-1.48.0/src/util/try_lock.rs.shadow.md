# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/try_lock.rs
@source-hash: c4ee49e1751ee0a7
@generated: 2026-02-09T18:06:52Z

## Primary Purpose
This module implements a non-blocking try-lock synchronization primitive for Tokio's internal use. It provides a simple, lightweight alternative to `std::sync::Mutex` when blocking is not desired.

## Key Structures

**`TryLock<T>` (L8-11)**: Main lock structure containing:
- `locked`: AtomicBool tracking lock state 
- `data`: UnsafeCell wrapping the protected data

**`LockGuard<'a, T>` (L13-16)**: RAII guard returned by successful lock acquisition:
- `lock`: Reference to the owning TryLock
- `_p`: PhantomData<Rc<()>> making guard !Send (not thread-transferable)

## Core Methods

**`TryLock::new()` (L35-43)**: Constructor with conditional const-ness:
- `const fn` variant for non-loom builds (L35-37)
- Regular `fn` for loom testing builds (L41-43)
- Both use `new!` macro for consistent initialization (L23-30)

**`try_lock()` (L46-59)**: Non-blocking lock acquisition:
- Uses atomic compare_exchange with SeqCst ordering
- Returns `None` if already locked, `Some(LockGuard)` on success
- Critical section: atomically sets locked flag from false to true

## Memory Safety & Concurrency

**Send/Sync Implementations (L18-21)**: 
- TryLock is Send+Sync when T is Send
- LockGuard is Sync when T is Sync
- LockGuard deliberately NOT Send due to PhantomData<Rc<()>>

**Deref Implementations (L62-74)**:
- Unsafe dereferencing of UnsafeCell data
- Protected by atomic lock state - only accessible when guard exists

**Drop Implementation (L76-80)**:
- Automatically releases lock by setting atomic bool to false
- Ensures lock is freed when guard goes out of scope

## Dependencies & Integration
- Uses `crate::loom::sync::atomic::AtomicBool` for testing compatibility
- Integrates with Tokio's loom-based testing framework
- SeqCst ordering ensures strong consistency across all operations

## Architectural Notes
- Designed for scenarios where lock contention should not block
- Simpler than std::sync::Mutex - no thread parking/waking
- Guard is deliberately !Send to prevent cross-thread guard transfer
- Uses UnsafeCell + atomic flag pattern for lock-free when uncontended
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot-0.12.5/src/remutex.rs
@source-hash: f0c0711ed46be67f
@generated: 2026-02-09T18:11:38Z

This file implements a reentrant mutex (recursive mutex) for the parking_lot crate, allowing a single thread to acquire the same lock multiple times without deadlocking.

## Core Components

**RawThreadId struct (L13)**: Implements thread identification for lock_api's reentrant mutex by using thread-local variable addresses as unique thread identifiers. The `nonzero_thread_id()` method (L18-27) leverages the fact that thread-local variable addresses are guaranteed to be unique per thread and non-zero.

**ReentrantMutex type alias (L41)**: Main reentrant mutex type that wraps `lock_api::ReentrantMutex` with `RawMutex` as the underlying primitive and `RawThreadId` for thread identification.

**const_reentrant_mutex function (L46-52)**: Const constructor for creating reentrant mutexes in constant contexts, using the INIT constants from both RawMutex and RawThreadId.

**ReentrantMutexGuard type alias (L59)**: RAII lock guard that automatically releases the lock when dropped. Unlike regular mutex guards, it provides only immutable access to the protected data.

**MappedReentrantMutexGuard type alias (L68-69)**: Mapped guard type for accessing subfields of protected data, with restrictions on temporary unlocking to prevent soundness issues.

## Key Dependencies

- `crate::raw_mutex::RawMutex`: Underlying mutex primitive
- `lock_api`: Provides the generic reentrant mutex implementation
- `core::num::NonZeroUsize`: Used for thread ID representation

## Architectural Decisions

The implementation uses thread-local variable addresses as thread identifiers rather than system thread IDs, which is portable and efficient. The reentrant nature allows nested locking from the same thread, making it suitable for recursive algorithms or complex call chains that might acquire the same lock multiple times.

## Usage Constraints

- ReentrantMutexGuard only provides immutable references to locked data
- Use RefCell for interior mutability when mutable access is needed
- MappedReentrantMutexGuard cannot be temporarily unlocked and re-locked

## Test Coverage

Comprehensive tests (L71-171) cover basic reentrancy, thread safety, try_lock functionality, debug formatting, guard bumping, and optional serde serialization.
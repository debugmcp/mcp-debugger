# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/lock_api-0.4.14/src/mutex.rs
@source-hash: 1487130ba159c915
@generated: 2026-02-09T18:11:44Z

## Primary Purpose
Generic mutex implementation providing safe synchronization primitives built on top of pluggable raw mutex backends. Part of the lock_api crate providing trait-based abstraction for various mutex implementations.

## Core Traits

**RawMutex (L36-79)**: Foundation trait defining basic mutex operations
- `INIT`: Constant for unlocked initialization
- `GuardMarker`: Type determining Send-ness of guards
- `lock()`, `try_lock()`, `unlock()`: Core locking primitives
- `is_locked()`: Default implementation using try_lock/unlock pattern

**RawMutexFair (L87-110)**: Extension trait for fair unlocking semantics
- `unlock_fair()`: Fair unlock protocol
- `bump()`: Yield to waiting threads (default impl: unlock_fair + lock)

**RawMutexTimed (L116-128)**: Extension trait for timeout-based locking
- Associated types `Duration` and `Instant` for no_std compatibility
- `try_lock_for()`, `try_lock_until()`: Timeout-based acquisition

## Core Types

**Mutex<R, T> (L138-141)**: Main mutex wrapper
- `raw: R`: Raw mutex implementation
- `data: UnsafeCell<T>`: Protected data
- Thread safety: Send if R+T are Send, Sync if R is Sync and T is Send

**MutexGuard<'a, R, T> (L504-507)**: RAII lock guard with lifetime
- Automatically unlocks on drop
- Implements Deref/DerefMut for data access
- Supports mapping to subfields via `map()`, `try_map()` functions

**ArcMutexGuard<R, T> (L733-736)**: Arc-based lock guard (feature: arc_lock)
- No lifetime constraints, owns Arc<Mutex>
- Similar API to MutexGuard but with Arc semantics

**MappedMutexGuard<'a, R, T> (L877-881)**: Guard for mapped subfields
- Points to subset of protected data via raw pointer
- Cannot be temporarily unlocked (soundness constraint)

## Key Methods

**Mutex construction**:
- `new()` (L149): Basic constructor using R::INIT
- `from_raw()` (L166): From pre-existing raw mutex
- `const_new()` (L179): Legacy alias for const contexts

**Locking operations**:
- `lock()` (L212): Blocking acquisition
- `try_lock()` (L227): Non-blocking attempt
- Arc variants: `lock_arc()` (L323), `try_lock_arc()` (L336)
- Timed variants: `try_lock_for()` (L373), `try_lock_until()` (L389)

**Guard operations**:
- `unlocked()` (L604): Temporarily release lock during closure execution
- `unlock_fair()` (L643): Fair unlock for MutexGuard
- `map()` (L526): Transform guard to point to subfield
- `leak()` (L621): Convert guard to raw mutable reference

## Safety Invariants
- Raw mutex implementations must ensure true exclusion
- `unlock()` methods require current thread to hold lock
- `make_guard_unchecked()` requires logical lock ownership
- Guards use PhantomData for proper variance and thread safety markers

## Feature Gates
- `arc_lock`: Enables Arc-based guards and methods
- `serde`: Serialization support (locks during serialize/deserialize)
- `owning_ref`: StableAddress implementations for guards

## Architectural Patterns
- Trait-based abstraction allowing pluggable mutex backends
- RAII guards ensure automatic cleanup
- Phantom types enforce thread safety requirements
- Guard mapping enables safe access to data subfields
- Fair/unfair unlock protocols for performance vs fairness tradeoffs
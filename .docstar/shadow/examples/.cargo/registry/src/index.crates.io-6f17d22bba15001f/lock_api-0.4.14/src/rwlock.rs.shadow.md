# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/lock_api-0.4.14/src/rwlock.rs
@source-hash: 3094177475cf67c8
@generated: 2026-02-09T18:11:54Z

## Overview
Generic reader-writer lock implementation providing a pluggable locking mechanism through trait abstraction. This is part of the `lock_api` crate which provides a common interface for various lock implementations.

## Core Architecture

**RwLock<R, T> (L330-333)**: The main reader-writer lock structure wrapping data `T` with a raw lock implementation `R`. Contains:
- `raw: R` - The underlying lock implementation  
- `data: UnsafeCell<T>` - Protected data wrapped in UnsafeCell for interior mutability

## Raw Lock Trait Hierarchy

**RawRwLock (L38-99)**: Base trait defining core reader-writer lock operations
- `INIT` constant for lock initialization (L43)
- `GuardMarker` type for Send/Sync properties (L47)
- Basic lock/unlock operations: `lock_shared()`, `try_lock_shared()`, `unlock_shared()`, `lock_exclusive()`, `try_lock_exclusive()`, `unlock_exclusive()`
- Lock status checking: `is_locked()` (L76-86), `is_locked_exclusive()` (L88-98)

**Extension Traits** for additional functionality:
- **RawRwLockFair (L107-149)**: Fair unlocking protocols with `unlock_shared_fair()`, `unlock_exclusive_fair()`, and bumping operations
- **RawRwLockDowngrade (L153-161)**: Atomic downgrade from exclusive to shared lock
- **RawRwLockTimed (L167-185)**: Timeout-based locking operations
- **RawRwLockRecursive (L194-200)**: Recursive read lock support
- **RawRwLockUpgrade (L219-247)**: Upgradable read locks that can be promoted to exclusive locks

## Guard Types

**RwLockReadGuard<'a, R, T> (L1253-1256)**: RAII read guard
- Implements `Deref<Target=T>` for data access (L1424-1430)
- Supports mapping with `map()`, `try_map()`, `try_map_or_err()` methods (L1275-1345)
- Fair unlocking support when `R: RawRwLockFair` (L1366-1422)

**RwLockWriteGuard<'a, R, T> (L1597-1600)**: RAII write guard
- Implements `Deref` and `DerefMut` (L1812-1825)
- Supports downgrading to read guard when `R: RawRwLockDowngrade` (L1710-1730)
- Mapping operations similar to read guard (L1619-1689)

**RwLockUpgradableReadGuard<'a, R, T> (L2047-2050)**: Special upgradable read guard
- Can be upgraded to write guard with `upgrade()` (L2084-2095) or `try_upgrade()` (L2101-2113)
- Supports `with_upgraded()` for temporary exclusive access (L2207-2220)
- Can be downgraded to regular read guard (L2183-2194)

## Arc-based Guards (Feature: arc_lock)

**ArcRwLockReadGuard<R, T> (L1466-1469)**: Static lifetime read guard using `Arc<RwLock<R, T>>`
**ArcRwLockWriteGuard<R, T> (L1860-1863)**: Static lifetime write guard 
**ArcRwLockUpgradableReadGuard<R, T> (L2413-2416)**: Static lifetime upgradable guard

These provide similar functionality to lifetime-bound guards but with `'static` lifetime.

## Mapped Guards

**MappedRwLockReadGuard<'a, R, T> (L2795-2799)**: Points to subfield of protected data
**MappedRwLockWriteGuard<'a, R, T> (L2963-2967)**: Mutable mapped guard

These support further mapping operations but don't support temporary unlocking for soundness.

## Key Patterns

**RAII Resource Management**: All guards automatically unlock on drop
**Conditional Compilation**: Heavy use of `#[cfg(feature = "...")]` for optional functionality
**Unsafe Abstractions**: Extensive use of unsafe code with detailed safety comments
**Generic Design**: Parameterized over raw lock implementation `R` and data type `T`
**Trait-based Extensions**: Modular functionality through trait hierarchy

## Safety Invariants
- Guards must hold appropriate locks when created
- Raw lock implementations must maintain exclusivity guarantees
- Mapped guards maintain lock state without re-acquiring
- Arc guards manage reference counting correctly during lock state transitions
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot-0.12.5/src/deadlock.rs
@source-hash: 7d3ebb5b4f636584
@generated: 2026-02-09T18:11:38Z

## Purpose
Deadlock detection module for the parking_lot crate that provides experimental deadlock detection capabilities. Re-exports core deadlock detection functionality from `parking_lot_core` and provides comprehensive test coverage.

## Key Components

### Public Interface
- **check_deadlock** (L37): Conditionally exported function that returns detected deadlocks when `deadlock_detection` feature is enabled
- **acquire_resource, release_resource** (L38): Internal resource tracking functions always available for the crate

### Test Infrastructure
- **DEADLOCK_DETECTION_LOCK** (L49): Static mutex ensuring test serialization due to global deadlock detection state
- **check_deadlock helper** (L51-54): Test utility that converts deadlock results to boolean

### Test Coverage
- **test_mutex_deadlock** (L57-99): Tests circular deadlock detection with 3 mutexes across 3 threads using barriers for synchronization
- **test_mutex_deadlock_reentrant** (L102-118): Tests self-deadlock detection when a thread attempts to lock the same mutex twice
- **test_remutex_deadlock** (L121-166): Tests deadlock detection with ReentrantMutex, including valid reentrant locking before circular deadlock
- **test_rwlock_deadlock** (L169-211): Tests reader-writer lock deadlocks with read locks attempting to upgrade to write locks
- **test_rwlock_deadlock_reentrant** (L215-231): Conditional test for RwLock read-to-write upgrade deadlock (disabled by default)

## Architecture Patterns
- **Feature gating**: Public API only available with `deadlock_detection` feature flag
- **Test serialization**: All tests acquire a global lock to prevent interference
- **Barrier synchronization**: Tests use barriers to create predictable deadlock scenarios
- **Temporal verification**: Tests verify deadlock absence before creation, presence during deadlock, and absence after resolution

## Dependencies
- **parking_lot_core::deadlock**: Core deadlock detection implementation
- **std::sync::{Arc, Barrier}**: Thread synchronization primitives
- **crate synchronization types**: Mutex, ReentrantMutex, RwLock for testing

## Critical Constraints
- Global deadlock detection state requires test serialization
- Feature flag controls API availability
- Tests rely on timing (50ms sleeps) which may be fragile in slow environments
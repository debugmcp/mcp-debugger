# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/loom/std/rwlock.rs
@source-hash: af8f98543e6e740d
@generated: 2026-02-09T18:02:54Z

## Purpose
Provides a non-poisoning wrapper around `std::sync::RwLock` for use in Tokio's loom testing framework. Eliminates panic behavior on poisoned locks by automatically recovering poisoned guards.

## Core Structure
- **RwLock<T>** (L6): Newtype wrapper around `std::sync::RwLock<T>` that implements poison-safe lock operations
  - Single field: `sync::RwLock<T>` (L6)
  - Marked `pub(crate)` for internal Tokio use only

## Key Methods
- **new()** (L11-13): Creates new RwLock instance wrapping std::sync::RwLock
- **read()** (L16-21): Blocking read lock acquisition with poison recovery via `into_inner()`
- **try_read()** (L24-30): Non-blocking read lock attempt, converts poisoned errors to valid guards
- **write()** (L33-38): Blocking write lock acquisition with poison recovery
- **try_write()** (L41-47): Non-blocking write lock attempt, handles both poison and would-block cases

## Dependencies
- `std::sync::{RwLockReadGuard, RwLockWriteGuard, TryLockError}` (L1)

## Architecture Pattern
Implements the "poison immunity" pattern by systematically catching `PoisonError` results and extracting inner guards via `into_inner()`. This ensures lock operations never panic due to thread panics while holding locks, making it suitable for async runtime use where panic propagation must be controlled.

## Critical Invariants
- All lock operations are poison-safe and will never panic on poisoned locks
- Try operations return `None` only for `WouldBlock`, never for poisoned state
- All methods preserve the original guard types from std::sync
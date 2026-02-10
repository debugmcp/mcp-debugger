# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/lock_api-0.4.14/src/
@generated: 2026-02-09T18:16:09Z

## Overview

The `lock_api` crate provides a comprehensive trait-based abstraction layer for synchronization primitives in Rust. This directory contains the core implementation that enables generic lock programming by separating lock state from protected data through pluggable raw lock backends.

## Architecture Pattern

The crate follows a three-tier architecture:

1. **Raw Lock Traits** (`RawMutex`, `RawRwLock`, `RawReentrantMutex`): Low-level unsafe interfaces that concrete lock implementations must provide
2. **Generic Wrapper Types** (`Mutex<R, T>`, `RwLock<R, T>`, `ReentrantMutex<R, G, T>`): Safe, high-level interfaces that wrap raw locks with protected data
3. **RAII Guards**: Automatic lock management through scoped guard types with `Deref`/`DerefMut` access to protected data

## Key Components

### Core Modules

- **`mutex.rs`**: Standard exclusive mutex with blocking/non-blocking acquisition, fair unlocking, and timeout support
- **`rwlock.rs`**: Reader-writer locks supporting shared/exclusive access patterns, with upgradable read locks and atomic downgrade operations  
- **`remutex.rs`**: Reentrant (recursive) mutexes allowing same-thread multiple acquisitions through thread ID tracking and lock counting

### Guard System

The crate provides a sophisticated guard hierarchy:
- **Lifetime Guards**: Standard RAII guards tied to lock lifetime (`MutexGuard`, `RwLockReadGuard`, etc.)
- **Arc Guards**: Static lifetime guards using `Arc<Lock>` for cross-thread ownership transfer (requires `arc_lock` feature)
- **Mapped Guards**: Guards pointing to subfields of protected data via `map()` operations

### Thread Safety Model

- **Guard Markers**: `GuardSend` and `GuardNoSend` types control compile-time Send/Sync behavior
- **Variance**: Phantom types ensure proper lifetime and thread safety constraints
- **No-std Compatible**: Core functionality works without standard library, with optional `alloc` support

## Extension Trait System

Modular functionality through optional traits:
- **Fair Locking**: `RawMutexFair`, `RawRwLockFair` for fairness guarantees
- **Timeouts**: `RawMutexTimed`, `RawRwLockTimed` for deadline-based acquisition
- **Upgrades/Downgrades**: `RawRwLockUpgrade`, `RawRwLockDowngrade` for lock promotion/demotion
- **Recursion**: `RawRwLockRecursive` and full reentrant mutex support

## Public API Surface

### Entry Points

```rust
// Standard mutex
let mutex = Mutex::<R, T>::new(data);
let guard = mutex.lock();

// Reader-writer lock
let rwlock = RwLock::<R, T>::new(data);
let read_guard = rwlock.read();
let write_guard = rwlock.write();

// Reentrant mutex
let remutex = ReentrantMutex::<R, G, T>::new(data, get_thread_id);
let guard = remutex.lock();
```

### Key Features

- **Generic over raw implementations**: Allows plugging in different mutex backends
- **Comprehensive guard operations**: Mapping, temporary unlocking, fair protocols
- **Arc-based ownership**: Static lifetime guards for complex ownership patterns
- **Feature-gated functionality**: Modular compilation based on required features

## Critical Design Elements

- **Type Safety**: Compile-time enforcement of thread safety and lock protocol compliance
- **Extensibility**: Raw lock implementors can opt into additional capabilities through trait implementation
- **Performance**: Zero-cost abstractions with inline optimizations and minimal overhead
- **Soundness**: Extensive unsafe code with detailed safety invariants and documentation

The directory represents a mature, production-ready synchronization library that provides both ease of use through safe abstractions and flexibility through its pluggable architecture.
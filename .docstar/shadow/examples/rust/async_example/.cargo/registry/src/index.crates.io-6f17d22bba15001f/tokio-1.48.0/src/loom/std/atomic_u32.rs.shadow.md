# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/loom/std/atomic_u32.rs
@source-hash: e22a0ab065af7389
@generated: 2026-02-09T18:02:51Z

## Purpose
Provides a custom atomic u32 wrapper (`AtomicU32`) with unsafe unsynchronized load capability for Tokio's loom testing framework. This is part of Tokio's internal synchronization primitives testing infrastructure.

## Key Components

### AtomicU32 struct (L7-9)
- Wraps `std::sync::atomic::AtomicU32` inside `UnsafeCell` to enable custom unsafe operations
- Provides thread-safe atomic operations through deref to standard library atomic
- Implements additional `unsync_load` for performance-critical scenarios under controlled conditions

### Safety Traits (L11-14)
- Manual `Send` and `Sync` implementations required due to `UnsafeCell` wrapper
- Panic safety traits (`RefUnwindSafe`, `UnwindSafe`) ensure proper behavior during unwinding

### Core Methods
- `new()` (L17-20): Const constructor wrapping value in atomic
- `unsync_load()` (L22-30): **UNSAFE** - Direct memory read bypassing atomic synchronization
  - Requires caller to ensure no concurrent mutations and all prior mutations are visible
  - Uses raw pointer read for maximum performance

### Standard Trait Implementations
- `Deref` (L33-41): Provides transparent access to underlying `AtomicU32` methods
- `Debug` (L43-47): Delegates formatting to wrapped atomic

## Architecture Notes
- Part of Tokio's loom module for deterministic concurrency testing
- The unsafe `unsync_load` is likely used in hot paths where synchronization guarantees are provided by higher-level constructs
- UnsafeCell wrapper pattern allows interior mutability while maintaining safety invariants through API design

## Critical Invariants
- `unsync_load` callers must guarantee exclusive access or visibility of all prior writes
- Deref implementation assumes inner atomic is never mutated unsafely (only through atomic operations)
# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/loom/std/atomic_u64.rs
@source-hash: dcc9507a2be40d89
@generated: 2026-02-09T18:02:50Z

**Platform-Adaptive Atomic U64 Implementation**

This module provides a unified interface for 64-bit atomic operations across different hardware architectures by conditionally selecting implementation strategies based on native atomic support.

**Core Architecture:**
- Uses conditional compilation to choose between native atomic operations (64-bit platforms) or mutex-based fallback (32-bit platforms)
- Abstracts platform differences behind a common interface through module re-exports

**Key Components:**
- `cfg_has_atomic_u64!` macro (L9-12): Conditionally includes native atomic implementation when platform supports 64-bit atomics
- `cfg_not_has_atomic_u64!` macro (L14-17): Conditionally includes mutex-based implementation for platforms lacking 64-bit atomic support
- Module path selection: 
  - `atomic_u64_native.rs` for platforms with native 64-bit atomic support
  - `atomic_u64_as_mutex.rs` for platforms requiring mutex-based emulation
- Public interface (L19): Re-exports `AtomicU64` and `StaticAtomicU64` types from the selected implementation

**Dependencies:**
- Relies on Rust's `cfg_target_has_atomic` feature detection (noted as unstable in comments L6-7)
- References external implementation files that provide the actual `AtomicU64` and `StaticAtomicU64` types

**Design Pattern:**
Implements the facade pattern to hide platform-specific atomic operation implementations behind a uniform interface. This allows higher-level code to use atomic operations without concerning itself with underlying hardware capabilities.

**Critical Constraints:**
- Implementation selection is compile-time only - no runtime switching between atomic strategies
- Both implementation modules must expose identical public APIs (`AtomicU64`, `StaticAtomicU64`)
- Performance characteristics differ significantly between native atomic and mutex-based implementations
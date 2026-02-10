# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/src/loom.rs
@source-hash: 7c89f9f5f900d5b9
@generated: 2026-02-09T18:11:25Z

**Purpose**: Conditional module providing atomic operations abstractions that work with both standard and Loom-based testing environments.

**Architecture**: Uses conditional compilation to provide two different implementations of the same interface:
- Non-Loom version (L1-24): Full atomic operations support for production/normal testing
- Loom version (L26-33): Minimal interface for Loom concurrency testing framework

**Key Components**:
- `sync::atomic` module: Contains atomic type re-exports and custom traits
- `AtomicPtr`, `AtomicUsize`, `Ordering` re-exports (L5, L7, L29): Platform-specific atomic types
- `AtomicMut<T>` trait (L9-13, L31): Custom trait for mutable access to atomic pointers

**Implementation Details**:
- Non-Loom `AtomicMut<T>` (L15-22): Provides `with_mut()` method that applies a closure to mutable pointer reference via `get_mut()`
- Loom `AtomicMut<T>` (L31): Empty trait implementation (no methods)
- Extra platforms support (L4-7): Conditional re-export from `extra_platforms` crate when feature flag enabled

**Dependencies**:
- `core::sync::atomic` or `extra_platforms` for atomic types (production)
- `loom::sync::atomic` for testing with Loom framework

**Critical Constraints**:
- Loom configuration disables the `with_mut` functionality entirely
- Feature flag `extra-platforms` determines atomic type source
- Module only accessible within crate (`pub(crate)`)
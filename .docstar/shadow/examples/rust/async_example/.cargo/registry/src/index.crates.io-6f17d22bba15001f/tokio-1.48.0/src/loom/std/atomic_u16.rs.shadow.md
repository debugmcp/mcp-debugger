# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/loom/std/atomic_u16.rs
@source-hash: c4be24b4fd5b6a17
@generated: 2026-02-09T18:02:49Z

**Primary Purpose:** Wrapper around `std::sync::atomic::AtomicU16` that adds an unsafe `unsync_load` method for unsynchronized access while maintaining standard atomic operations via `Deref`.

**Key Components:**

- **AtomicU16 struct (L7-9):** Wraps `std::sync::atomic::AtomicU16` in `UnsafeCell` to enable unsafe direct memory access
- **Safety trait implementations (L11-14):** Manually implements `Send`, `Sync`, `RefUnwindSafe`, and `UnwindSafe` to maintain thread safety guarantees
- **Constructor `new` (L17-20):** Creates new instance with initial value, const-evaluable
- **Unsafe `unsync_load` (L28-30):** Performs direct memory read bypassing atomic synchronization - requires caller to ensure no concurrent mutations and all mutations happened-before this load
- **Deref implementation (L33-41):** Provides transparent access to standard `AtomicU16` methods by dereferencing to inner atomic
- **Debug implementation (L43-47):** Forwards debug formatting to inner atomic

**Dependencies:**
- `std::cell::UnsafeCell` for interior mutability
- `std::sync::atomic::AtomicU16` as the underlying atomic primitive
- Standard traits: `Deref`, `Debug`, panic safety traits

**Architectural Pattern:** This is a "loom" testing module variant - provides standard atomic interface plus unsafe escape hatch for performance-critical code paths that can guarantee ordering constraints externally.

**Critical Safety Invariants:**
- `unsync_load` requires happens-before relationship with all mutations
- `unsync_load` requires absence of concurrent mutations during access
- `Deref` access is safe because it only exposes `&self` methods, never unsafe mutations
# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/rwlock/owned_write_guard.rs
@source-hash: c972e47c18db00b0
@generated: 2026-02-09T18:03:20Z

**Purpose:** RAII guard for owned exclusive write access to `RwLock<T>` data. Manages automatic lock release on drop while allowing lock ownership transfer through `Arc<RwLock<T>>`.

**Core Structure:** 
- `OwnedRwLockWriteGuard<T>` (L17-26): Main guard with `Arc<RwLock<T>>` ownership, raw data pointer, permit count, and optional tracing span
- `Inner<T>` (L29-35): Helper struct for transferring ownership without triggering Drop

**Key Methods:**
- `skip_drop()` (L38-51): Transfers ownership to `Inner<T>` using `ManuallyDrop` to prevent automatic drop
- `map()` (L86-101): Creates `OwnedRwLockMappedWriteGuard` for data subset using closure transformation
- `try_map()` (L210-231): Fallible version of `map()` that returns original guard on `None`
- `downgrade()` (L359-392): Converts write guard to read guard atomically, releases excess permits
- `downgrade_map()` (L135-172): Combines mapping and downgrading in one operation
- `try_downgrade_map()` (L269-312): Fallible downgrade_map variant
- `into_mapped()` (L320-322): Converts to mapped guard without transformation
- `rwlock()` (L410-412): Returns reference to underlying `Arc<RwLock<T>>`

**Critical Behaviors:**
- **Permit Management:** Write guards hold `permits_acquired` permits (typically all available permits for exclusive access)
- **Downgrade Logic:** Releases `permits_acquired - 1` permits when converting to read guard, keeping one for read access
- **Memory Safety:** Uses raw pointers with lifetime tied to Arc, ensuring data validity
- **Drop Semantics:** Automatically releases all permits on drop (L447-459)

**Trait Implementations:**
- `Deref`/`DerefMut` (L415-427): Transparent access to protected data via unsafe pointer dereferencing
- `Debug`/`Display` (L429-445): Forwards to wrapped data's formatting
- `Drop` (L447-459): Releases permits and logs tracing events

**Dependencies:**
- Integrates with `OwnedRwLockMappedWriteGuard` for mapped access patterns
- Converts to `OwnedRwLockReadGuard` for read access
- Requires `Arc<RwLock<T>>` for owned semantics
- Optional tracing integration for runtime monitoring

**Architecture Notes:**
- Uses phantom data for proper variance
- Supports conditional tracing compilation via feature flags
- Implements zero-cost abstractions over raw synchronization primitives
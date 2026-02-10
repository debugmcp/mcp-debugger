# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/rwlock/write_guard_mapped.rs
@source-hash: 6a227b97f8344a1c
@generated: 2026-02-09T18:03:19Z

## RwLockMappedWriteGuard - Tokio Async RwLock Mapped Write Guard

**Primary Purpose**: RAII guard for exclusive write access to a subset/projection of data protected by an RwLock, created by mapping an `RwLockWriteGuard`. Prevents downgrading operations to avoid undefined behavior with mapped data.

**Key Components**:

**Main Structure** - `RwLockMappedWriteGuard<'a, T>` (L15-24):
- `permits_acquired: u32` (L20) - Number of semaphore permits held
- `s: &'a Semaphore` (L21) - Reference to underlying semaphore for synchronization
- `data: *mut T` (L22) - Raw pointer to mapped data subset
- `marker: PhantomData<&'a mut T>` (L23) - Lifetime and mutability marker
- `resource_span: tracing::Span` (L19) - Optional tracing span for debugging

**Helper Structure** - `Inner<'a, T>` (L27-33): 
Mirror of main fields used in drop-skipping operations to transfer ownership without running destructor.

**Core Methods**:

**Mapping Operations**:
- `skip_drop()` (L36-47): Transfers ownership to `Inner` without running destructor using `ManuallyDrop`
- `map<F, U>()` (L85-100): Maps guard to different data type/subset via closure, creates new guard with same permits
- `try_map<F, U>()` (L141-162): Conditional mapping that returns original guard if closure returns `None`

**Trait Implementations**:
- `Deref/DerefMut` (L168-180): Unsafe dereferencing of raw data pointer
- `Debug/Display` (L182-198): Forward formatting to underlying data
- `Drop` (L200-212): Releases semaphore permits and updates tracing state

**Architecture Notes**:
- Uses raw pointers for data access requiring unsafe operations
- Prevents downgrading (L164-165 comment) because mapped guards may have internal mutability issues
- Semaphore-based synchronization with permit counting
- Optional tracing integration for runtime debugging
- Memory management via `ManuallyDrop` for precise drop control

**Safety Invariants**:
- Data pointer must remain valid for guard lifetime
- Semaphore permits must be released exactly once
- No downgrade operations allowed to prevent UB with mapped data

**Dependencies**:
- `crate::sync::batch_semaphore::Semaphore` for synchronization
- `std::marker::PhantomData` for lifetime management
- Optional `tracing` for observability
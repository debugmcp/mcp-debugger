# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/rwlock/read_guard.rs
@source-hash: ef65da1df5042f80
@generated: 2026-02-09T18:03:16Z

**Primary Purpose:** RAII guard for shared read access to Tokio's async RwLock, automatically releasing the read lock when dropped.

**Core Structure:**
- `RwLockReadGuard<'a, T>` (L15-23): Main guard struct with semaphore reference, raw data pointer, and phantom data for lifetime management
- `Inner<'a, T>` (L26-31): Helper struct for ownership transfer during guard transformations

**Key Fields:**
- `s: &'a Semaphore` (L20): Reference to the underlying semaphore managing lock state
- `data: *const T` (L21): Raw pointer to the protected data
- `marker: PhantomData<&'a T>` (L22): Ensures proper lifetime and Send/Sync bounds
- `resource_span: tracing::Span` (L19): Optional tracing span for observability (tokio_unstable feature)

**Critical Methods:**
- `skip_drop()` (L34-44): Transfers ownership to Inner struct without running destructor, used for guard transformations
- `map()` (L80-94): Creates a new guard for a component of the locked data using closure transformation
- `try_map()` (L132-149): Attempts guard transformation, returning original guard on closure failure
- `deref()` (L155-157): Provides immutable access to protected data via raw pointer dereference

**Drop Behavior:**
- `Drop::drop()` (L179-190): Releases semaphore permit and emits tracing events, ensuring lock cleanup

**Safety Invariants:**
- Raw pointer `data` must remain valid for guard's lifetime
- Semaphore reference must outlive the guard
- Guard transformations must preserve semaphore ownership
- Phantom data ensures proper variance and lifetime relationships

**Dependencies:**
- `crate::sync::batch_semaphore::Semaphore`: Core locking mechanism
- Optional tracing integration for observability
- Standard library for memory management and formatting

**Architectural Pattern:**
RAII guard pattern with transformation support, enabling safe projection operations on locked data while maintaining semaphore-based exclusion guarantees.
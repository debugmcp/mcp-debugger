# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/idle_notified_set.rs
@source-hash: 941983f6e8db72ea
@generated: 2026-02-09T18:06:54Z

**Purpose:** Task notification tracking system for async collections. Provides a thread-safe collection that tracks which tasks have been woken (notified) versus idle, typically used by task management utilities like JoinSet.

**Core Architecture:**
- `IdleNotifiedSet<T>` (L23-26): Main handle maintaining two internal linked lists (idle/notified) and length tracking
- `EntryInOneOfTheLists<'a, T>` (L38-41): Borrowed handle guaranteeing entry exists in one of the lists, preventing premature removal
- `ListEntry<T>` (L91-102): Individual list node containing value, parent reference, list position state, and linked list pointers
- `Lists<T>` = `Mutex<ListsInner<T>>` (L43): Thread-safe wrapper around the dual list structure
- `ListsInner<T>` (L49-55): Contains notified/idle linked lists plus optional shared waker

**Key State Management:**
- `List` enum (L64-69): Tracks entry location (Notified/Idle/Neither)
- Entries move atomically between lists via waker notifications
- `Neither` state used during removal/draining operations
- Length tracking maintained separately from list operations

**Critical Methods:**
- `insert_idle()` (L150-168): Adds new entry to idle list, returns borrowed handle
- `pop_notified()` (L172-204): Moves entry from notified→idle list for processing, updates shared waker
- `try_pop_notified()` (L208-232): Non-blocking version without waker update
- `for_each()` (L235-275): Safely iterates all entries by collecting raw pointers under single lock
- `drain()` (L281-342): Removes all entries with panic-safe cleanup via `AllEntries` bomb pattern
- `remove()` (L364-400): Removes specific entry, transitions to `Neither` state

**Waker Integration:**
- `Wake` impl for `ListEntry<T>` (L434-466): Moves entry from idle→notified list on wake
- Shared waker in `ListsInner` gets notified when any entry moves to notified list
- `waker_ref()` utility creates context for polling entries

**Memory Safety Guarantees:**
- `PhantomPinned` prevents entry movement after creation
- `ManuallyDrop<T>` for controlled value destruction
- Extensive unsafe blocks with safety comments for lock-free pointer operations
- Reference counting via `Arc<ListEntry<T>>` prevents use-after-free

**Concurrency Model:**
- Single mutex protects both lists and entry state transitions
- Send/Sync bounds allow cross-thread usage with appropriate `T` constraints
- Lock-free waker creation (ListEntry is Send+Sync regardless of T bounds)

**Dependencies:**
- `linked_list` module for intrusive list implementation
- `loom` compatibility for testing/verification
- `waker_ref` utility for efficient waker creation
# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/io/registration_set.rs
@source-hash: e4c0291c89a21253
@generated: 2026-02-09T18:03:05Z

## Primary Purpose
Registration set for managing I/O resource lifecycle within Tokio's runtime. Coordinates allocation, deregistration, and cleanup of `ScheduledIo` objects with the I/O driver to prevent use-after-free scenarios during async I/O operations.

## Key Structures

### RegistrationSet (L13-15)
Primary interface for registration lifecycle management. Contains atomic counter `num_pending_release` for lock-free notification of pending cleanup work.

### Synced (L17-30)
Synchronized state structure containing:
- `is_shutdown` (L20): Boolean flag preventing new registrations during shutdown
- `registrations` (L23): LinkedList tracking all active I/O registrations
- `pending_release` (L29): Vector buffering registrations awaiting cleanup

## Core Operations

### Allocation (L56-70)
`allocate()` creates new `ScheduledIo` wrapped in `Arc`, adds to active registrations list. Returns error if shutdown flag is set.

### Deregistration (L74-81)
`deregister()` moves registration to pending release buffer, updates atomic counter. Returns true when buffer reaches `NOTIFY_AFTER` threshold (16), signaling I/O driver should process cleanup.

### Cleanup (L104-113)
`release()` processes pending release buffer, removing registrations from active list and resetting atomic counter.

### Shutdown (L83-102)
`shutdown()` drains all active registrations, preventing new allocations and returning all outstanding I/O handles for cleanup.

## Memory Safety Pattern

Uses unsafe `remove()` operation (L117-123) with caller-guaranteed invariants. Implements `linked_list::Link` trait (L127-146) for `Arc<ScheduledIo>` to enable intrusive linked list storage while maintaining Arc reference counting semantics.

## Critical Constants

- `NOTIFY_AFTER = 16` (L11): Batching threshold for triggering I/O driver notification

## Dependencies

- `ScheduledIo`: Core I/O registration object
- `LinkedList`: Intrusive linked list implementation
- `EXPOSE_IO`: Provenance tracking mechanism for unsafe operations
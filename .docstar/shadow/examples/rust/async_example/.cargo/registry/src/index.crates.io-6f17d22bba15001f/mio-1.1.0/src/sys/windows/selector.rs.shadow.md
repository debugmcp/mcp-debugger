# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/windows/selector.rs
@source-hash: 76faa07846037dac
@generated: 2026-02-09T18:03:33Z

## Primary Purpose and Responsibility

This file implements the Windows-specific event selector for the Mio async I/O library. It provides edge-triggered socket event notification using Windows' Auxiliary Function Driver (AFD) and I/O Completion Ports (IOCP). The selector manages socket polling operations and simulates edge-triggered behavior on top of Windows' level-triggered APIs.

## Key Classes and Functions

**AfdGroup (L32-83)**: Manages a pool of AFD handles for socket operations
- `new()` (L39): Creates new group with completion port reference
- `acquire()` (L56): Gets an AFD handle, creating new ones when pool size exceeds `POLL_GROUP_MAX_GROUP_SIZE` (32)
- `release_unused_afd()` (L46): Cleanup unused AFD handles based on reference counts
- `_alloc_afd_group()` (L76): Internal allocation of new AFD handle

**SockState (L93-295)**: Core socket state management for individual socket polling
- `new()` (L262): Creates new socket state with AFD handle and base socket resolution
- `update()` (L115): Main state machine for socket polling - handles Idle/Pending/Cancelled states
- `cancel()` (L185): Cancels pending AFD poll operations
- `feed_event()` (L199): Processes completed IOCP events and converts to Mio events
- `set_event()` (L279): Updates user event interests and determines if update queue addition needed
- `mark_delete()` (L245): Marks socket for deletion and cancels pending operations

**Selector (L327-400)**: Public interface for the Windows selector
- `new()` (L334): Creates new selector with unique ID and inner implementation
- `select()` (L358): Main event polling entry point with timeout support
- `register()` (L377): Registers socket with interests and token
- `reregister()` (L386): Updates existing socket registration

**SelectorInner (L403-725)**: Core selector implementation
- `new()` (L414): Initializes completion port, update queue, and AFD group
- `select2()` (L448): Internal select implementation handling IOCP polling and event processing
- `update_sockets_events()` (L469): Updates all queued socket states before polling
- `feed_events()` (L486): Processes IOCP completion events into Mio events
- `register()` (L535): Internal socket registration with AFD polling setup
- `queue_state()` (L613): Adds socket state to update queue

## Important Dependencies and Relationships

- **AFD (Auxiliary Function Driver)**: Windows kernel driver for socket operations via `super::afd`
- **IOCP (I/O Completion Ports)**: Windows async I/O mechanism via `super::iocp`
- **IoStatusBlock**: Windows I/O operation status tracking
- **CompletionPort**: IOCP wrapper for event notification
- Uses `windows_sys` crate for Windows API bindings

## Notable Patterns and Architectural Decisions

**Edge-Trigger Simulation**: Implements edge-triggered semantics by clearing user events after delivery (L233) and requiring reregistration to re-enable events

**Reference Counting Memory Management**: Uses `Pin<Arc<Mutex<SockState>>>` for thread-safe socket state with kernel memory lifetime management via `into_overlapped()` (L299) and `from_overlapped()` (L307)

**Update Queue Pattern**: Defers socket polling setup via update queue (L405) to batch operations and handle concurrent registration during polling

**Base Socket Resolution**: Implements fallback mechanism for LSP (Layered Service Provider) compatibility using multiple IOCTL codes (L650-680)

**Thread Safety**: Uses atomic polling flag (L407) and mutex-protected update queue for concurrent access control

## Critical Invariants and Constraints

- Only one AFD poll operation per socket allowed at a time
- Socket states must be pinned due to kernel memory usage (`PhantomPinned` L111)
- Maximum 32 sockets per AFD handle (`POLL_GROUP_MAX_GROUP_SIZE`)
- Selector polling is single-threaded (enforced by `is_polling` atomic)
- Socket deletion requires cancelling pending operations before cleanup
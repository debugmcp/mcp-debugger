# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/set_once.rs
@source-hash: 2acea3f85f2c4945
@generated: 2026-02-09T18:06:51Z

## Purpose
Thread-safe cell that can only be written to once, providing async wait capabilities. Inspired by Python's `asyncio.Event`, this synchronization primitive allows one-time initialization with asynchronous waiting for completion.

## Core Structure
**SetOnce<T> (L91-95)**: Main synchronization primitive with three fields:
- `value_set: AtomicBool`: Tracks initialization state using acquire/release ordering
- `value: UnsafeCell<MaybeUninit<T>>`: Thread-unsafe storage for the actual value
- `notify: Notify`: Tokio's notification primitive for waking waiting tasks

## Key Methods

**Construction (L148-246)**:
- `new()` (L148): Creates empty SetOnce
- `const_new()` (L190): Const variant for static variables (non-loom builds)
- `new_with(Option<T>)` (L203): Conditional initialization
- `const_new_with(T)` (L240): Const constructor with value
- `From<T>` implementation (L136): Direct value initialization

**State Management (L250-329)**:
- `initialized()` (L250): Atomic check with Acquire ordering
- `get()` (L263): Returns `Option<&T>`, safe access to value
- `get_unchecked()` (L257): Unsafe direct access, requires initialized state
- `set(T)` (L280): One-time value setting with double-checked locking pattern
- `into_inner()` (L311): Consumes SetOnce, returns owned value

**Async Operations (L339-358)**:
- `wait()` (L339): Async method that blocks until value is set, cancel-safe
- Uses polling loop with `notify.notified()` and `poll_fn` for efficient waiting

## Thread Safety Implementation
**Send/Sync bounds (L366-371)**:
- `Sync` requires `T: Sync + Send` due to shared reference access
- `Send` requires only `T: Send` as atomic guards protect access

**Memory Safety**:
- Double-checked locking in `set()` using `notify.lock_waiter_list()` guard
- Acquire/Release ordering prevents data races
- Proper `Drop` implementation (L125) handles initialized values only

## Error Handling
**SetOnceError<T> (L380)**: Simple wrapper error containing the rejected value when attempting to set an already-initialized SetOnce.

## Dependencies
- `super::Notify`: Tokio's async notification system
- `crate::loom::*`: Testing/verification framework abstractions
- Standard library atomics and unsafe cell primitives

## Architecture Notes
- Uses unsafe code for performance but maintains safety through atomic coordination
- Memory ordering is critical: Release on write, Acquire on read
- TODOs mention potential `get_mut()` optimizations for exclusive access scenarios
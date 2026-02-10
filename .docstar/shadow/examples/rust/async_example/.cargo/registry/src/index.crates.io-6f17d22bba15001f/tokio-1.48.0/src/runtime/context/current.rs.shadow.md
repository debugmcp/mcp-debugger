# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/context/current.rs
@source-hash: 977d1ca823c051c3
@generated: 2026-02-09T18:03:03Z

## Purpose
Thread-local runtime handle management for Tokio's async runtime. Provides RAII-based mechanism to set and restore the current active scheduler handle with proper nesting support.

## Key Types

### SetCurrentGuard (L9-20)
RAII guard that manages the current runtime handle state. Contains:
- `prev`: Previously active handle for restoration (L13)
- `depth`: Nesting level for this guard (L16) 
- `_p`: PhantomData to prevent cross-thread movement (L19)

### HandleCell (L22-28)
Thread-local storage for current handle state:
- `handle`: RefCell containing optional scheduler handle (L24)
- `depth`: Cell tracking nested `try_set_current` calls (L27)

## Key Functions

### try_set_current (L33-35)
Attempts to set a scheduler handle as current, returning guard on success. Uses CONTEXT thread-local variable.

### with_current (L37-46)
Executes closure with current handle if available. Returns `TryCurrentError` if no context exists or thread-local is destroyed.

### Context::set_current (L49-63)
Core implementation that:
- Replaces current handle with new one (L50)
- Increments depth counter with overflow protection (L51-56)
- Returns SetCurrentGuard for cleanup

### HandleCell::new (L67-72)
Constructor creating empty handle cell with zero depth.

## Drop Implementation (L75-96)
Critical cleanup logic in SetCurrentGuard::Drop:
- Validates guards dropped in reverse order (L80-91)
- Panics if out-of-order drop detected (unless already panicking)
- Restores previous handle and decrements depth (L93-94)

## Dependencies
- `super::CONTEXT`: Thread-local context storage
- `scheduler::Handle`: Runtime scheduler handle type
- `TryCurrentError`: Error type for context access failures

## Architectural Notes
- Thread-local design prevents accidental cross-thread handle sharing
- Depth tracking ensures proper RAII nesting semantics
- Guard-based API prevents handle leaks and ensures cleanup
- Panic-safe: continues cleanup even during panics to avoid corrupted state
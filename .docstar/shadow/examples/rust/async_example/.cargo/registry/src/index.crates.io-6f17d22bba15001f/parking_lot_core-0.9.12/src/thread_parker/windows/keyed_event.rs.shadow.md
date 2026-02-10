# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot_core-0.9.12/src/thread_parker/windows/keyed_event.rs
@source-hash: 12b72b70ad9d58d9
@generated: 2026-02-09T18:03:24Z

## Purpose
Windows-specific thread parking implementation using NT Keyed Events - an advanced synchronization primitive that allows threads to wait on specific keys. This is part of parking_lot's low-level threading infrastructure for efficient thread blocking/unblocking.

## Key Components

### KeyedEvent (L23-164)
Core wrapper around Windows NT Keyed Events with function pointers to ntdll.dll APIs:
- `handle`: NT kernel object handle for the keyed event
- `NtReleaseKeyedEvent`/`NtWaitForKeyedEvent`: Function pointers dynamically loaded from ntdll.dll
- `create()` (L51-86): Factory method that dynamically loads NT APIs and creates keyed event handle
- `prepare_park()` (L89-91): Sets atomic state to PARKED
- `park()` (L99-102): Blocks thread indefinitely until unparked
- `park_until()` (L105-147): Blocks with timeout, handling complex timeout conversion and edge cases
- `unpark_lock()` (L150-163): Atomically marks thread as unparked and returns handle for actual wakeup

### UnparkHandle (L179-194)
Deferred unpark mechanism that separates state change from actual thread wakeup:
- Holds key pointer and keyed event reference
- `unpark()` (L188-193): Performs actual NT release operation after lock is released

### State Management (L16-18)
Thread parking states tracked via atomic operations:
- `STATE_UNPARKED` (0): Thread is running
- `STATE_PARKED` (1): Thread is blocked waiting
- `STATE_TIMED_OUT` (2): Thread timed out while waiting

## Key Patterns

### Dynamic API Loading
Uses runtime loading of NT APIs from ntdll.dll with `GetModuleHandle`/`GetProcAddress` and `mem::transmute` for function pointer casting.

### Timeout Conversion Algorithm (L118-132)
Converts Rust `Instant` to NT's 100ns relative timeout format with overflow protection. NT uses negative values for relative timeouts.

### Unpark Synchronization Protocol
Two-phase unpark prevents race conditions:
1. Atomically change state while holding queue lock (`unpark_lock`)
2. Actually wake thread after releasing lock (`UnparkHandle::unpark`)

### Edge Case Handling
Complex logic in `park_until()` handles the race where another thread unparks while timing out - ensures NT keyed event state consistency by calling `park()` if needed.

## Dependencies
- Windows NT APIs: NtCreateKeyedEvent, NtWaitForKeyedEvent, NtReleaseKeyedEvent
- Windows kernel32: GetModuleHandle, GetProcAddress, CloseHandle
- Local bindings module for NT constants and types

## Critical Invariants
- KeyedEvent must have `'static` lifetime due to NT handle requirements
- All NT API calls must be balanced (every wait must have corresponding release)
- State transitions must be atomic to prevent race conditions
- Timeout calculations must handle overflow gracefully
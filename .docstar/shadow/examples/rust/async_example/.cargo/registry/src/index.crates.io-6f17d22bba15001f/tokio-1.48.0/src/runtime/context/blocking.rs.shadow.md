# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/context/blocking.rs
@source-hash: 7cd0eadc6b556e40
@generated: 2026-02-09T18:03:06Z

**Primary Purpose:** Thread-local context management for blocking operations within Tokio runtime, providing safe guards and mechanisms to prevent deadlocks by controlling when blocking operations can occur.

**Key Components:**

**BlockingRegionGuard (L11-13):** RAII guard that tracks when code has entered a blocking region outside the runtime context. Contains `NotSendOrSync` marker via PhantomData to prevent cross-thread usage. Must be used (`#[must_use]`).

**DisallowBlockInPlaceGuard (L15):** Simple boolean wrapper guard that temporarily disallows blocking-in-place operations until dropped.

**Core Functions:**

- `try_enter_blocking_region() (L17-31)`: Attempts to create a BlockingRegionGuard by checking if currently inside a runtime context. Returns `None` if already in runtime, `Some(guard)` otherwise. Falls back to permissive behavior if thread-locals are being destroyed during shutdown.

- `disallow_block_in_place() (L34-50)`: Creates a guard that temporarily disables `allow_block_in_place` flag in runtime context, returning a guard that will restore the previous state on drop.

**BlockingRegionGuard Methods:**

- `new() (L53-55)`: Simple constructor creating guard with PhantomData marker
- `block_on<F>() (L59-67)`: Blocks current thread on a future using `CachedParkThread`, returning future's result or AccessError
- `block_on_timeout<F>() (L73-102)`: Blocks on future with timeout using polling loop, parking thread between polls, returns `Ok(result)` or `Err(())` on timeout

**Drop Implementation (L105-120):** DisallowBlockInPlaceGuard restores original `allow_block_in_place` state when dropped, but only if it was changed during construction (tracked by boolean flag).

**Key Dependencies:**
- `CONTEXT`: Thread-local storage for runtime state
- `EnterRuntime`: Enum tracking runtime entry state with blocking permissions
- `CachedParkThread`: Low-level thread parking mechanism
- `crate::task::coop::budget`: Cooperative task yielding mechanism

**Critical Invariants:**
- BlockingRegionGuard prevents Send/Sync to avoid cross-thread confusion
- Guards use RAII pattern to ensure proper cleanup
- Graceful degradation when thread-locals are destroyed during shutdown
- Timeout implementation respects cooperative scheduling via budget()
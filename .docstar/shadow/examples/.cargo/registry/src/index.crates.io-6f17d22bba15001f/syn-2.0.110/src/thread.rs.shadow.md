# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/thread.rs
@source-hash: 1f1deb1272525ab2
@generated: 2026-02-09T18:11:57Z

**Primary Purpose**: Thread-safe wrapper type that restricts access to values based on thread ownership, enabling `Sync` and conditional `Send` traits for otherwise non-thread-safe types.

**Core Structure**: 
- `ThreadBound<T>` (L7-10): Wraps value `T` with the thread ID where it was created
- Stores original thread ID via `std::thread::current().id()` on construction

**Key Methods**:
- `new(value: T)` (L21-26): Creates wrapper capturing current thread ID
- `get(&self) -> Option<&T>` (L28-34): Returns value reference only if called from original thread, None otherwise

**Thread Safety Implementation**:
- `unsafe impl<T> Sync` (L12): Manually implements Sync for any T, enabling cross-thread sharing
- `unsafe impl<T: Copy> Send` (L18): Implements Send only for Copy types to prevent Drop in wrong thread
- Safety relies on Copy types having no interior mutability (guaranteed by UnsafeCell not implementing Copy)

**Additional Traits**:
- `Debug` impl (L37-43): Shows actual value if on correct thread, "unknown" otherwise  
- `Copy/Clone` impls (L54-59): Available for Copy types, clone delegates to copy operator

**Safety Invariants**:
- Copy requirement for Send prevents destructors running on wrong thread
- Copy types cannot contain interior mutability (UnsafeCell constraint)
- Thread ID check ensures single-thread access to wrapped value

**Dependencies**: `std::thread::ThreadId`, `std::fmt::Debug`

**Usage Pattern**: Enables sharing non-Sync types across threads while maintaining single-threaded access semantics.
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/thread_id.rs
@source-hash: ad85f1057b2c6183
@generated: 2026-02-09T18:06:40Z

This file implements a thread-safe unique thread identifier system for the Tokio runtime.

**Primary Purpose:** Generates globally unique thread identifiers using atomic operations to avoid collisions in concurrent environments.

**Key Components:**

- `ThreadId` struct (L4): A newtype wrapper around `NonZeroU64` that represents a unique thread identifier. Implements standard traits (Eq, PartialEq, Clone, Copy, Hash, Debug) for use as a key type.

- `ThreadId::next()` method (L7-24): The core ID generation function that:
  - Uses a static atomic counter `NEXT_ID` (L10) for thread-safe global state
  - Implements compare-and-swap loop (L12-23) for lock-free ID generation
  - Handles overflow by calling `exhausted()` (L14-16)
  - Returns `NonZeroU64`-wrapped ID, safe to unwrap since counter starts at 0

- `exhausted()` function (L29-30): Cold path panic handler for the extremely unlikely case of counter overflow (would require 2^64 threads).

**Dependencies:**
- Uses `crate::loom::sync::atomic` for atomic operations (supports both real and testing environments)
- Standard library `NonZeroU64` for space-efficient Option-like behavior

**Architectural Decisions:**
- Lock-free design using compare-exchange for high performance under contention
- `#[cold]` annotation on panic path for better optimization
- `pub(crate)` visibility limits usage to within the crate
- NonZeroU64 wrapper enables niche optimization in enums/Options

**Critical Invariants:**
- Thread IDs are globally unique and never reused
- Counter starts at 0, first ID is 1 (due to NonZeroU64::new)
- No race conditions in ID generation due to atomic CAS loop
# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/time/tests/mod.rs
@source-hash: 430bf3f8b3873500
@generated: 2026-02-09T17:58:25Z

**Primary Purpose:** Test module for Tokio's timer runtime infrastructure, specifically testing TimerEntry behavior across different execution models (loom for concurrency testing, regular runtime, and miri for memory safety).

**Key Utilities:**
- `block_on` (L14-25): Conditional async executor - uses loom's block_on for concurrency testing or creates single-threaded runtime for regular tests
- `model` (L27-33): Test harness wrapper - executes under loom model checking for concurrency tests or runs directly for regular tests  
- `rt` (L35-41): Runtime factory that creates current-thread runtime with time support and optional paused start
- `normal_or_miri` (L192-198): Environment-aware value selector for adjusting test parameters based on miri execution

**Core Test Scenarios:**
- `single_timer` (L43-70): Validates basic timer completion after time advancement, using thread spawning and manual time progression
- `drop_timer` (L72-104): Tests timer cleanup behavior when dropped before completion, polling twice with noop waker
- `change_waker` (L106-137): Verifies timer behavior when waker changes between polls, switching from noop to real waker
- `reset_future` (L139-189): Complex timer reset test using atomic flag synchronization, validates timer doesn't complete early after reset from 1s to 2s deadline
- `poll_process_levels` (L200-233): Stress test creating multiple timers with incrementing deadlines, validates correct ready/pending states as time advances
- `poll_process_levels_targeted` (L235-255): Focused test with specific timing values (193ms deadline, processing at 62ms and 192ms)
- `instant_to_tick_max` (L257-269): Boundary condition test for maximum safe duration conversion using MAX_SAFE_MILLIS_DURATION

**Dependencies:**
- `std::time::Duration`, `std::task::Context` for async primitives
- `futures::task::noop_waker_ref` for waker creation (non-loom builds)
- `crate::loom` for thread-safe primitives and concurrency testing abstractions
- `super::TimerEntry` as the primary test subject

**Architectural Patterns:**
- Conditional compilation with `#[cfg(loom)]` and `#[cfg(not(loom))]` for dual testing modes
- Manual time control through `process_at_time()` for deterministic testing
- Pin-based futures handling with `pin!()` macro usage
- Thread spawning for concurrent timer testing scenarios

**Critical Constraints:**
- WASI target exclusion via `#![cfg(not(target_os = "wasi"))]`
- Time advancement uses nanosecond precision (2_000_000_000 = 2 seconds)
- MAX_SAFE_MILLIS_DURATION boundary enforcement for tick conversion safety
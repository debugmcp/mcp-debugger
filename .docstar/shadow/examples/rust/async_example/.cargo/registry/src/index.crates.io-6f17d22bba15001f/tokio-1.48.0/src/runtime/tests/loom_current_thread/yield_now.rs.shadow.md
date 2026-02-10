# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/tests/loom_current_thread/yield_now.rs
@source-hash: eec0f029e9e536ba
@generated: 2026-02-09T17:58:17Z

**Primary Purpose**: Loom-based concurrency test for Tokio's `yield_now()` function in current-thread runtime, verifying that yielding causes the thread to park before rescheduling.

**Key Components**:
- `yield_calls_park_before_scheduling_again()` (L4-26): Main test function that uses Loom model checking to verify yield behavior
- `mk_runtime()` (L28-30): Helper function creating a current-thread Tokio runtime

**Test Logic**:
The test spawns an async task that:
1. Records current thread ID and park count (L13-14)
2. Calls `yield_now().await` to yield execution (L16) 
3. Verifies park count increased by 1 if still on same thread (L18-21)

**Dependencies**:
- `crate::runtime::park` - for accessing park count metrics
- `crate::runtime` - for Runtime and Builder
- `loom` - for model checking concurrency behavior

**Architectural Patterns**:
- Uses Loom's deterministic model checking with limited permutations (L7-8)
- Employs thread ID checking to handle potential thread migration
- Tests internal park counting mechanism to verify yield implementation

**Critical Invariants**:
- `yield_now()` must increment park count by exactly 1 when staying on same thread
- Runtime uses current-thread scheduler (single-threaded)
- Park count tracking must be accurate for yield verification
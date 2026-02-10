# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/context/runtime.rs
@source-hash: df7b8deca59426ac
@generated: 2026-02-09T18:03:02Z

**Primary Purpose:** Runtime context management for Tokio's async executor, providing thread-local state tracking and preventing nested runtime entry.

**Core Components:**

**EnterRuntime Enum (L8-17):** State machine tracking runtime execution context
- `Entered { allow_block_in_place: bool }` - Thread is within runtime with blocking permissions
- `NotEntered` - Thread not in runtime or in blocking region
- `is_entered()` method (L96-98) - State query helper

**EnterRuntimeGuard Struct (L19-30):** RAII guard managing runtime entry lifecycle
- `blocking: BlockingRegionGuard` - Tracks blocking function calls
- `handle: SetCurrentGuard` - Current runtime handle reference  
- `old_seed: RngSeed` - Previous RNG state for restoration
- Drop implementation (L82-93) restores thread-local state on exit

**enter_runtime Function (L34-74):** Core runtime entry point with nested execution prevention
- Takes scheduler handle, blocking permissions, and closure
- Accesses thread-local CONTEXT to check current state
- If already entered, panics with detailed error message
- If not entered: sets runtime state, generates new RNG seed, creates guard
- Returns closure result with blocking guard access

**Key Dependencies:**
- `CONTEXT` - Thread-local storage for runtime state
- `scheduler::Handle` - Runtime scheduler interface
- `FastRand/RngSeed` - Random number generation for task scheduling
- `BlockingRegionGuard/SetCurrentGuard` - Context management utilities

**Architecture Patterns:**
- RAII pattern for automatic cleanup via Drop trait
- Thread-local storage for per-thread runtime state
- Guard objects preventing resource leaks
- Panic-based error handling for invariant violations

**Critical Invariants:**
- Only one runtime context per thread (enforces single-threaded executor model)
- RNG seed properly restored on guard drop
- Runtime state correctly transitioned between Entered/NotEntered
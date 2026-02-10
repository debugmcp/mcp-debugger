# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/tests/mod.rs
@source-hash: 7f71b4ab0ff8df30
@generated: 2026-02-09T18:03:18Z

**Primary Purpose**: Test module organization for Tokio's synchronization primitives, using conditional compilation to switch between regular tests and Loom-based concurrency testing.

**Architecture**: 
- Uses Tokio's custom conditional compilation macros (`cfg_not_loom!`, `cfg_loom!`) to maintain separate test suites
- Regular tests (L1-5): Standard unit tests for atomic_waker, notify, and semaphore_batch modules
- Loom tests (L7-18): Model checking tests using the Loom library for detecting concurrency bugs

**Key Test Modules**:
- `atomic_waker` (L2): Tests for atomic waker functionality
- `notify` (L3): Tests for notification primitives  
- `semaphore_batch` (L4): Tests for batch semaphore operations
- `loom_*` modules (L8-17): Loom-based concurrency model checking variants of core sync primitives including broadcast, mpsc, oneshot, watch, rwlock, and set_once

**Dependencies**: 
- Tokio's internal cfg macros for conditional compilation
- Loom library (implied by loom_ prefixed modules) for concurrency testing

**Testing Strategy**: Dual testing approach where each synchronization primitive has both traditional tests and model-checked variants to ensure correctness under different execution orderings and race conditions.
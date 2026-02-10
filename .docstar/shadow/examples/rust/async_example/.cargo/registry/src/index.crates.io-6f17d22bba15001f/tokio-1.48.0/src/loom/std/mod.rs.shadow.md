# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/loom/std/mod.rs
@source-hash: a8a02a74e9481fc4
@generated: 2026-02-09T18:03:01Z

**Primary Purpose:** 
Standard library compatibility layer for Tokio's loom testing framework. Provides consistent synchronization primitives and system interfaces that can be swapped between standard library implementations and loom testing mocks.

**Key Modules and Functions:**

- **Module Imports (L3-12):** Imports custom atomic types, synchronization primitives, and thread safety wrappers
- **cell module (L14-16):** Re-exports UnsafeCell wrapper for interior mutability
- **future module (L18-26):** Conditionally exports AtomicWaker for async coordination (requires net/process/signal/sync features)
- **hint module (L28-30):** Re-exports std::hint::spin_loop for CPU optimization hints
- **rand module (L32-45):** Provides simple random number generation using hash-based seeding
  - `seed()` function (L40-44): Generates u64 seeds using atomic counter and RandomState hasher
- **sync module (L47-80):** Central synchronization primitive exports with feature-based selection
  - Conditionally uses parking_lot (L54-58) vs std sync primitives (L60-68) based on feature flags
  - **atomic submodule (L70-77):** Re-exports custom and standard atomic types
- **sys module (L82-110):** System-level utilities
  - `num_cpus()` function: Returns CPU count with TOKIO_WORKER_THREADS environment variable override (L84-104) or returns 1 for single-threaded builds (L107-109)
- **thread module (L112-123):** Thread management utilities
  - `yield_now()` (L113-116): CPU yield implementation using spin_loop
  - Re-exports standard thread APIs (L119-122)

**Key Dependencies:**
- std synchronization primitives (Arc, Weak, Mutex, RwLock, Condvar, atomics)
- Optional parking_lot crate for enhanced synchronization (when feature enabled and not in miri)
- crate::sync::AtomicWaker for async waking
- Custom atomic type wrappers from sibling modules

**Architectural Patterns:**
- Feature-gate driven conditional compilation for different sync implementations
- Consistent re-export interface hiding implementation details from consumers
- Environment variable configuration for runtime behavior (TOKIO_WORKER_THREADS)
- Loom testing compatibility through abstraction layer

**Critical Constraints:**
- Miri incompatibility with parking_lot (excluded via feature gates)
- TOKIO_WORKER_THREADS must be valid usize > 0
- Module only active when not using full loom testing mode